import express from 'express'
import bodyParser from 'body-parser'
import cookieParser from 'cookie-parser'
import pg from 'pg'
import * as db from './db/index.js'
import authRoutes from './Routes/Auth.js'
import userRoutes from './Routes/User.js'
import dotenv from 'dotenv'

const app = express()
const port = 3000


app.use(bodyParser.json())
app.use (
    bodyParser.urlencoded({
        extended: true                              // support for all properties (including numbers and booleans) in the query string
    })
)
dotenv.config()
app.use(cookieParser())
await db.getClient().then(()=>{
    console.log('Connected to database')
}).catch((err)=>{
    console.log(err)
})

app.use('/api/auth',authRoutes)
app.use('/api/user',userRoutes)

//   console.log(await client.query('SELECT * FROM public."Products"'))
app.use((err,req,res,next)=>{
    const status = err.status || 500
    const message = err.message || "Unknown Error Occured"
    return res.status(status).json({
        success: false,
        status,
        message
    })
})

app.listen(port, ()=>{
    console.log(`Server is running on port ${port}`)
})