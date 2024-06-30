const express = require('express')
const app = express();
const cors = require('cors');
require('dotenv').config();

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 6006;

const corsOption = {
    origin: [
      'http://localhost:5173',
      'http://localhost:5174',
      'https://assignment-20dc7.web.app',
      
  ],
    credentials: true,
  }
  
  app.use(cors(corsOption));
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.erh7g8c.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;


const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const mealsCollection = client.db("uniBitesDB").collection('meals');

    // app.get('/meals', async (req, res) => {
    //     const result = await mealsCollection.find().toArray();
    //   res.send(result)
    // })
 

app.get('/meals', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 0; 
  const skip = (page - 1) * limit;

  const filter = req.query.filter
  let query = {}
  if(filter) query ={ category: filter}

  const result = limit > 0 
    ? await mealsCollection.find(query).skip(skip).limit(limit).toArray()
    : await mealsCollection.find().toArray();

  res.send(result);
});

    app.get('/meal/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await mealsCollection.findOne(query);
      res.send(result);
    })



    // await client.db("admin").command({ ping: 1 });
    // console.log("Pinged your deployment. You successfully connected to MongoDB!");

  } finally {
    
  }
}
run().catch(console.dir);


app.get('/',(req, res) => {
    res.send('12 server')
})

app.listen(port, () => {
    console.log(`12 server ${port}`);
})