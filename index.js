const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require('jsonwebtoken');
require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 6006;

const corsOption = {
  origin: [
    "http://localhost:5173",
    "http://localhost:5174",
    "https://assignment-20dc7.web.app",
  ],
  credentials: true,
};

app.use(cors(corsOption));
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.erh7g8c.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const mealsCollection = client.db("uniBitesDB").collection("meals");
    const usersCollection = client.db("uniBitesDB").collection("users");
    const packageCollection = client.db("uniBitesDB").collection("package");
    const paymentsCollection = client.db("uniBitesDB").collection('payments');

    
    //middlewares
    const verifyToken = (req, res, next) => {
      if(!req.headers.authorization) {
        return res.status(401).send({message: 'unauthorized access'})
      }
      const token = req.headers.authorization.split(' ')[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if(err) {
          return res.status(401).send({ message: 'unauthorized access'})
        }
        req.decoded = decoded;
        next();
      })
    }

    //jwt related api
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: '1hr'
      })
      res.send({token});
    })

    app.get("/meals", async (req, res) => {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 0;
      const skip = (page - 1) * limit;

      const filter = req.query.filter;
      const priceRange = req.query.priceRange;
      let query = {};

      if (filter) {
        query.category = filter;
      }

      if (priceRange) {
        const [min, max] = priceRange.split("-").map(Number);
        query.price = { $gte: min, $lte: max };
      }

      const result =
        limit > 0
          ? await mealsCollection.find(query).skip(skip).limit(limit).toArray()
          : await mealsCollection.find(query).toArray();

      res.send(result);
    });

    app.get("/mealsCount", async (req, res) => {
      const filter = req.query.filter;
      const priceRange = req.query.priceRange;
      let query = {};

      if (filter) query = { category: filter };
      if (priceRange) {
        const [min, max] = priceRange.split("-").map(Number);
        query.price = { $gte: min, $lte: max };
      }

      const count = await mealsCollection.countDocuments(query);
      res.send({ count });
    });

    app.get("/meal/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await mealsCollection.findOne(query);
      res.send(result);
    });

    //save new user in db

    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const isExist = await usersCollection.findOne(query);

      if (isExist) {
        return res.send({ message: "user already exist", insertedId: null });
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    //create-payment-intent

    app.post("/create-payment-intent", async (req, res) => {
      const price = req.body.price;
      const priceInCent = parseFloat(price) * 100;

      if(!price || priceInCent < 1) return;
      //generate client secret
      const { client_secret } = await stripe.paymentIntents.create({
        amount: priceInCent,
        currency: "usd",
        automatic_payment_methods: {
          enabled: true,
        },
      });
      //send client secret as response
      res.send({clientSecret: client_secret })
    });

    //save payment in db
    app.post("/payments", async (req, res) => {
      const paymentInfo = req.body;
      const result = await paymentsCollection.insertOne(paymentInfo);
      res.send(result);
    })
    app.get("/package", async (req, res) => {
      const result = await packageCollection.find().toArray();
      res.send(result);
    });

    app.get("/package/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await packageCollection.findOne(query);
      res.send(result);
    });

    // await client.db("admin").command({ ping: 1 });
    // console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("12 server");
});

app.listen(port, () => {
  console.log(`12 server ${port}`);
});
