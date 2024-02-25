import express from 'express'
import * as db from '../db/index.js'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import genErr from '../error.js'

const router = express.Router()

//Register for a new user
router.post('/register', (req, res) => {
    const { name, email, password } = req.body
    if (!name || !email || !password) {
        return res.status(400).json({ msg: 'Please enter all fields' })
    }
    const salt = bcrypt.genSaltSync(10)
    const hashPassword = bcrypt.hashSync(req.body.password,salt)

    db.query('SELECT * FROM public."Customers" WHERE email = $1', [email])
        .then((user) => {
            if (user.rows.length > 0) {
                return res.status(400).json({ msg: 'User already exists' })
            } else {
                const query = `INSERT INTO public."Customers" (name, email, password) VALUES ($1, $2, $3) RETURNING *`
                const values = [name, email, hashPassword]
                db.query(query, values)
                    .then((user) => {
                        res.status(200).send("User Created successfully")
                    })
                    .catch((err) => {
                        res.status(500).json({ msg: 'Something went wrong' })
                    })
            }
        })
})

router.post('/login', (req, res) => {
    const { email, password } = req.body
    if (!email || !password) {
        return res.status(400).json({ msg: 'Please enter all fields' })
    }
    db.query('SELECT * FROM public."Customers" WHERE email = $1', [email])
        .then((user) => {
            if (user.rows.length > 0) {
                const validPassword = bcrypt.compareSync(password, user.rows[0].password)
                if (validPassword) {
                    const token = jwt.sign({ id: user.rows[0].id }, process.env.JWT)
                    res.cookie('access_token', token, { httpOnly: true })
                    res.status(200).json({ msg: 'Login Successful', user: user.rows[0] })
                } else {
                    res.status(400).json({ msg: 'Invalid Credentials' })
                }
            } else {
                res.status(400).json({ msg: 'Invalid Credentials' })
            }
        })
})

export default router