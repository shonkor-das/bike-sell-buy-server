const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const stripe = require("stripe")('sk_test_51MMvsWICsW0LrcNLdtjVBUnm3m0Olz2IEfNokOQKjt6Zn6MbdLXEATgBHkzvYuN4ozZKRTlrEcCZan3fChXfjbMi00CF97XZF5');

const port = process.env.PORT || 5000;

const app = express();

// middleware
app.use(cors());
app.use(express.json());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ndj1c5s.mongodb.net/?retryWrites=true&w=majority`;
console.log(uri);
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyJWT(req, res, next){
    // console.log('token ', req.headers.authorization);
    const authHeader = req.headers.authorization;
    if(!authHeader){
        return res.send(401).send('unauthorized access');
    }
    const token = authHeader.split(' ')[1];

    jwt.verify(token, process.env.ACCESS_TOKEN, function(err, decoded){
        if(err){
            return res.status(403).send({massage: 'forbidden access'})
        }
        req.decoded = decoded;
        next();
    })
}

async function run(){
    try{
        const productCollection = client.db('bikeSellBuy').collection('products');
        const bookingsCollection = client.db('bikeSellBuy').collection('bookings');
        const usersCollection = client.db('bikeSellBuy').collection('users');
        const productDataCollection = client.db('bikeSellBuy').collection('products');

        // make sure you are verifyAdmin after verifyJWT
        const verifyAdmin = async(req, res, next) =>{
            // console.log('inside verifyAdmin', req.decoded.email);
            const decodedEmail = req.decoded.email;
            const query ={email: decodedEmail};
            const user = await usersCollection.findOne(query);

            if(user?.role !== 'admin'){
                return res.status(403).send({message: 'forbidden access'})
            }
            next();
        }

        app.get('/products', async(req, res) =>{
            const query = {};
            const productOptions = await productCollection.find(query).toArray();
            res.send(productOptions);
        });

        app.get('/bookings', verifyJWT, async(req, res) =>{
            const email = req.query.email;
            const decodedEmail = req.decoded.email;

            if(email !== decodedEmail){
                return res.status(403).send({massage: 'forbidden access'});
            }
            // console.log('token', req.headers.authorization);
            const query = {email: email};
            const bookings = await bookingsCollection.find(query).toArray();
            res.send(bookings);
        });

        app.get('/bookings/:id', async(req,res) =>{
            const id = req.params.id;
            const query = {_id: ObjectId(id)};
            const booking = await bookingsCollection.findOne(query);
            res.send(booking);
        });

        app.post('/bookings', async(req, res) =>{
            const booking = req.body
            console.log(booking);
            const result = await bookingsCollection.insertOne(booking);
            res.send(result);
        });

        app.post('/create-payment-intent', async (req, res) =>{
            const booking = req.body;
            const price = booking.price;
            const amount = price * 100;

            const paymentIntent = await stripe.paymentIntents.create({
                currency: 'usd',
                amount: amount,
                "payment_method_types": [
                    "card"
                ]
            });
            
            res.send({
                clientSecret: paymentIntent.client_secret,
            });
        })

        app.get('/jwt', async(req, res) =>{
            const email = req.query.email;
            const query = {email:email};
            const user = await usersCollection.findOne(query);
            if(user){
                const token = jwt.sign({email}, process.env.ACCESS_TOKEN, {expiresIn: '1h'})
                return res.send({accessToken: token});
            }
            res.status(403).send({accessToken: ''})
        });

        app.get('/users', async(req, res) =>{
            const query = {};
            const users = await usersCollection.find(query).toArray();
            res.send(users);
        });

        app.get('/users/admin/:email', async(req, res) =>{
            const email = req.params.email;
            const query = {email}
            const user = await usersCollection.findOne(query);
            res.send({isAdmin: user?.role === 'admin'});
        });

        app.post('/users', async(req, res) =>{
            const user =req.body;
            const result = await usersCollection.insertOne(user);
            res.send(result);
        });

        app.put('/users/admin/:id',verifyJWT, verifyAdmin, async(req, res) =>{
            const id = req.params.id;
            const filter = {_id: ObjectId(id)}
            const options = {upsert: true};
            const updateDoc = {
                $set: {
                    role: 'admin'
                }
            }
            const result = await usersCollection.updateOne(filter, updateDoc, options);
            res.send(result);
        });

        // temporary data update price field on product data
        // app.put('/addPrice', async(req,res) =>{
        //     const filter = {}
        //     const options = {upsert: true}
        //     const updateDoc = {
        //         $set: {
        //             role: 12500.00
        //         }
        //     }
        //     const result = await productCollection.updateMany(filter, updateDoc, options);
        //     res.send(result);
        // })

        app.get('/productData', async(req, res) =>{
            const query = {}
            const result = await productCollection.find(query).project({name: 1}).toArray();
            res.send(result);
        });

        app.get('/bikeDatas', verifyJWT, verifyAdmin, async(req, res) =>{
            const query = {}
            const result = await productDataCollection.find(query).toArray();
            res.send(result);

        });

        app.post('/bikeDatas', verifyJWT, verifyAdmin, async(req, res) =>{
            const bikeDatas = req.body;
            const result = await productDataCollection.insertOne(bikeDatas);
            res.send(result);
        });

        app.delete('/bikeDatas/:id', verifyJWT, verifyAdmin, async(req, res) =>{
            const id = req.params.id;
            const filter = {_id: ObjectId(id)};
            const result = await productDataCollection.deleteOne(filter);
            res.send(result);
        })
    }
    finally{

    }
}

run().catch(console.log);

app.get('/', async(req, res) =>{
    res.send('bike sell-buy serever is running');
})

app.listen(port, () => console.log(`Bike sell-buy running on ${port}`));