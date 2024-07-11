const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
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
    const paymentsCollection = client.db("uniBitesDB").collection("payments");
    const requestedMealsCollection = client
      .db("uniBitesDB")
      .collection("requestedMeals");
    const likesCollection = client.db("uniBitesDB").collection("likes");
    const reviewsCollection = client.db("uniBitesDB").collection("reviews");

    //middlewares
    const verifyToken = (req, res, next) => {
      //console.log('inside verify token', req.headers.authorization);
      if (!req.headers.authorization) {
        //  console.log(req.headers.authorization);
        //  console.log('1ar');
        return res.status(401).send({ message: "unauthorized access" });
      }
      const token = req.headers.authorization.split(" ")[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          console.log("2nd");
          console.log("server", err);
          return res.status(401).send({ message: "unauthorized access" });
        }
        req.decoded = decoded;
        next();
      });
    };

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const isAdmin = user?.role === "admin";
      if (!isAdmin) {
        return res.status(403).send({ message: "forbidden access " });
      }
      next();
    };

    //jwt related api
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1hr",
      });
      res.send({ token });
    });

    //admin verification api
    app.get("/user/admin/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "unauthorized access" });
      }
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === "admin";
      }
      res.send({ admin });
    });

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

    //adding new meals
    app.post("/meal", verifyToken, verifyAdmin, async (req, res) => {
      const mealInfo = req.body;
      const result = await mealsCollection.insertOne(mealInfo);
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

    //loaduserinfo from db
    app.get("/user/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = { email: email };

      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "forbidden access" });
      }
      const result = await usersCollection.findOne(query);
      res.send(result);
    });
    //get all user
    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    //make admin api
    app.patch("/user/admin/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    });
    //user rpackage update
    app.patch("/user/package/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const subscription = req.body.package;
      const query = { email: email };
      const updateDoc = {
        $set: {
          package: subscription,
        },
      };
      const result = await usersCollection.updateOne(query, updateDoc);
      res.send(result);
    });

    //saving requested meal in db
    app.post("/requested-meal", async (req, res) => {
      const requestMealInfo = req.body;
      const result = await requestedMealsCollection.insertOne(requestMealInfo);
      res.send(result);
    });

    //get all requested meal

    app.get("/requested-meal", verifyToken, verifyAdmin, async (req, res) => {
      const result = await requestedMealsCollection.find().toArray();
      res.send(result);
    });

    //getting all the requested meal by single user
    app.get("/requested-meal/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "forbidden access" });
      }
      const query = { userEmail: email };
      const result = await requestedMealsCollection.find(query).toArray();
      res.send(result);
    });

    //update status
    app.patch(
      "/requested-meal/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const updateDoc = {
          $set: {
            status: "Delivered",
          },
        };
        const result = await requestedMealsCollection.updateOne(
          query,
          updateDoc
        );
        res.send(result);
      }
    );

    app.delete("/requested-meal/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await requestedMealsCollection.deleteOne(query);
      res.send(result);
    });

    //create-payment-intent
    app.post("/create-payment-intent", verifyToken, async (req, res) => {
      const price = req.body.price;
      const priceInCent = parseFloat(price) * 100;

      if (!price || priceInCent < 1) return;
      //generate client secret
      const { client_secret } = await stripe.paymentIntents.create({
        amount: priceInCent,
        currency: "usd",
        automatic_payment_methods: {
          enabled: true,
        },
      });
      //send client secret as response
      res.send({ clientSecret: client_secret });
    });

    //save payment in db
    app.post("/payments", verifyToken, async (req, res) => {
      const paymentInfo = req.body;
      const result = await paymentsCollection.insertOne(paymentInfo);
      res.send(result);
    });

    //get payments for single user
    app.get("/my-payments/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "forbiden access" });
      }
      const result = await paymentsCollection.find(query).toArray();
      res.send(result);
    });

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

    //like increase api
    app.post("/like/:mealId", verifyToken, async (req, res) => {
      const mealId = req.params.mealId;
      const query = { _id: new ObjectId(mealId) };
      const email = req.body.email;
      try {
        const alreadyLiked = await likesCollection.findOne({ mealId, email });

        if (alreadyLiked) {
          return res.send({ message: "already liked" });
        }

        await likesCollection.insertOne({ email, mealId });
        const result = await mealsCollection.updateOne(query, {
          $inc: {
            likes: 1,
          },
        });
        res.status(200).json({ message: "Liked successfully", result });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    //undo like
    app.post("/unlike/:mealId", verifyToken, async (req, res) => {
      const mealId = req.params.mealId;
      const query = { _id: new ObjectId(mealId) };
      const email = req.body.email;
      const decodeEmail = req.decoded.email;
      if (email === decodeEmail) {
        try {
          const liked = await likesCollection.findOne({ email, mealId });
          if (!liked) return;

          await likesCollection.deleteOne({ email, mealId });
          const result = await mealsCollection.updateOne(query, {
            $inc: {
              likes: -1,
            },
          });
          res.send(result);
        } catch (error) {
          console.log(error);
          res.send(error);
        }
      }
    });

    //check if user has liked a meal
    app.get("/liked/:mealId", verifyToken, async (req, res) => {
      const mealId = req.params.mealId;
      const email = req.query.email;

      try {
        const liked = await likesCollection.findOne({ email, mealId });

        res.status(200).json({ liked: !!liked });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    ///review add api with upda
    app.post("/review", verifyToken, async (req, res) => {
      const reviewInfo = req.body;
      const mealId = new ObjectId(req.body.mealId);

      try {
        const meal = await mealsCollection.findOne({ _id: mealId });
        if (!meal) {
          return res.status(404).send({ message: "Meal not found" });
        }

        let newRating;
        if (meal.reviews_count === 0) {
          newRating = req.body.rating;
        } else {
          const totalRating =
            meal.rating * meal.reviews_count + req.body.rating;
          newRating = totalRating / (meal.reviews_count + 1);
        }

        const updateDoc = {
          $inc: { reviews_count: 1 },
          $set: {
            rating: newRating,
          },
        };
        await mealsCollection.updateOne({ _id: mealId }, updateDoc);

        const result = await reviewsCollection.insertOne(reviewInfo);
        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "An error occurred while submitting the review" });
      }
    });

    app.put("/review/:mealId", verifyToken, async (req, res) => {
      const mealId = req.params.mealId;
      const query = { _id: new ObjectId(mealId) };

      const meal = await mealsCollection.findOne(query);
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          reviews_count: meal.reviews_count,
          likes: meal.likes,
        },
      };
      const result = await reviewsCollection.updateMany(
        { mealId: mealId },
        updateDoc,
        options
      );
      res.send(result);
    });

    //get review by meal id
    app.get("/reviews/:mealId", verifyToken, async (req, res) => {
      const mealId = req.params.mealId;
      const query = { mealId: mealId };
      const result = await reviewsCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/review/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status.send({ message: "forbidden access" });
      }
      const query = { email: email };
      const result = await reviewsCollection.find(query).toArray();
      res.send(result);
    });

    app.delete("/review/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await reviewsCollection.deleteOne(query);
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
