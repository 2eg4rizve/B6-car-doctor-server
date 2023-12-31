const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 5000;

//middleware
app.use(
  cors({
    origin: ["http://localhost:5173", "http://localhost:5174"],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

// console.log(process.env.DB_USER);

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.qcgfq9t.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// custom middleware
const logger = async (req, res, next) => {
  console.log("Now Url : ", req.host, req.originalUrl);
  next();
};

const verifyToken = async (req, res, next) => {
  const token = req?.cookies?.token;
  console.log("value of token in middleware : ", token);
  if (!token) {
    return res.status(401).send({ message: "not authorized" });
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    //error
    if (err) {
      return res.status(401).send({ message: "unauthorized" });
    }

    //if token is valid then it would be decoded

    console.log("Value in the decoded token ", decoded);

    req.user = decoded;

    next();
  });
};

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)

    await client.connect();
    const serviceCollection = client.db("carDoctor").collection("services");
    const bookingCollection = client.db("carDoctor").collection("bookings");

    //auth related api jwt
    app.post("/jwt", logger, async (req, res) => {
      const user = req.body;
      console.log("User for token: ", user);

      //making token
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });

      //cookie(name,value,option)

      // save cookie
      res
        .cookie("token", token, {
          httpOnly: true,
          secure: false,
          // sameSite: 'none'
        })
        .send({ success: true });
    });

    // logout and cookies clear
    app.post("/logout", async (req, res) => {
      const user = req.body;
      console.log("logout and clear cookies  user email : ", user)
      res.clearCookie('token',{maxAge: 0}) .send({success: true});

    });

    //services related api
    app.get("/services", logger, async (req, res) => {
      const cursor = serviceCollection.find();
      const result = await cursor.toArray();

      res.send(result);
    });

    app.get("/services/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };

      const options = {
        projection: { title: 1, price: 1, service_id: 1, img: 1 },
      };

      const result = await serviceCollection.findOne(query, options);
      res.send(result);
    });

    //bookings
    //some data get
    app.get("/bookings", logger, verifyToken, async (req, res) => {
      // console.log("email when booking from client side : ",req.query.email);
      // console.log("email when booking from valid token: ", req.user);
      // console.log("token when booking : ", req.cookies.token);

      if (req.query.email != req.user.email) {
        return res.status(403).send({ message: "forbidden access" });
      }
      let query = {};
      if (req.query?.email) {
        query = { email: req.query.email };
      }
      const result = await bookingCollection.find(query).toArray();
      res.send(result);
    });

    //post
    app.post("/bookings", async (req, res) => {
      const booking = req.body;
      console.log("booking : ", booking);

      const result = await bookingCollection.insertOne(booking);

      res.send(result);
    });

    app.delete("/bookings/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await bookingCollection.deleteOne(query);

      res.send(result);
    });

    app.patch("/bookings/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };

      const updatedBooking = req.body;
      console.log("updatedBooking : ", updatedBooking);

      const updateDoc = {
        $set: {
          status: updatedBooking.status,
        },
      };

      const result = await bookingCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Car Doctor Server is Running");
});

app.listen(port, () => {
  console.log(`Car Doctor Server Is Running On Port ${port}`);
});

// npm i jsonwebtoken

// node
//require('crypto).randomBytes(64).toString('hex')


//npm i cookie-parser
