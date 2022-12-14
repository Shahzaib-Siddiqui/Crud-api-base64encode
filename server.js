var express = require("express");
var path = require("path");
var bodyParser = require("body-parser");
var cors = require("cors");
var morgan = require("morgan");
const mongoose = require("mongoose");
var bcrypt = require("bcrypt-inzi");
var jwt = require("jsonwebtoken");
var SERVER_SECRET = "4321";
let dbURI =
  "mongodb+srv://dbjahan:dbjahan@cluster0.8ric4.mongodb.net/test?retryWrites=true&w=majority";
mongoose.connect(dbURI, { useNewUrlParser: true, useUnifiedTopology: true });

mongoose.connection.on("connected", function () {
  console.log("Mongoose is connected");
});
mongoose.connection.on("disconnected", function () {
  console.log("Mongoose is disconnected");
});
mongoose.connection.on("error", function (err) {
  console.log("Mongoose connection error", err);
  process.exit(1);
});
process.on("SIGINT", function () {
  console.log("app is terminating");
  mongoose.connection.close(function () {
    console.log("Mangoose default connection closed");
    process.exit(0);
  });
});

var userSchema = new mongoose.Schema({
  name: String,
  email: String,
  password: String,
  phone: String,
  gender: String,
  createdOn: { type: Date, default: Date.now },
});
var userModel = mongoose.model("users", userSchema);

var app = express();

app.use(bodyParser.json());
app.use(
  cors({
    origin: "*",
  })
);
app.use(morgan("dev"));
app.use("/", express.static(path.resolve(path.join(__dirname, "public"))));
app.post("/signup", (req, res, next) => {
  if (
    !req.body.email ||
    !req.body.password
  ) {
    res.status(403).send(`
            please send name, email, passwod, phone and gender in json body.
            e.g:
            {
                "email": "shahzaib@gmail.com",
                "password": "123",
            }`);
    return;
  }
  userModel.findOne({ email: req.body.email }, function (err, data) {
    if (err) {
      console.log(err);
    } else if (!data) {
      bcrypt.stringToHash(req.body.password).then((dbPassword) => {
        console.log("hash: ", dbPassword);
        var newUser = new userModel({
          name: req.body.name,
          email: req.body.email,
          password: dbPassword,
          phone: req.body.phone,
          gender: req.body.gender,
        });
        newUser.save((err, data) => {
          if (!err) {
            res.send({
              message: "User created",
              status: 200,
            });
          } else {
            console.log(err);
            res.status(500).send("user create error, " + err);
          }
        });
      });
    } else {
      res.send({
        message: "Already registered",
      });
      console.log(data);
    }
  });
});
app.post("/login", (req, res, next) => {

  let decode = Buffer.from(
    req.headers.authorization.split(" ")[1],
    "base64"
  ).toString("ascii");

  let email = decode.split(":")[0];
  let password = decode.split(":")[1];
  if (!email || !password) {
    res.status(403).send(`
            please send email and passwod in json body.
            e.g:
            {
                "email": "shahzaib@gmail.com",
                "password": "321",
            }`);
    return;
  }
  userModel.findOne({ email: email }, function (err, user) {
    console.log(user);
    if (err) {
      console.log(err);
      res.send({
        message: "Database error",
      });
    } else if (user) {
      bcrypt
        .varifyHash(password, user.password)
        .then((isMatched) => {
          if (isMatched) {
            const token = jwt.sign(
              {
                id: user._id,
                name: user.name,
                email: user.email,
                phon: user.phone,
                gender: user.gender,
              },
              SERVER_SECRET,
              { expiresIn: "10s" }
            );
            res.send({
              status: 200,
              message: "login success",
              user: {
                name: user.name,
                email: user.email,
                phone: user.phone,
                gender: user.gender,
              },
              token: token,
            });
          } else {
            console.log("not matched");
            res.status(401).send({
              message: "incorrect password",
            });
          }
        })
        .catch((e) => {
          console.log("error: ", e);
        });
    } else {
      res.status(403).send({
        message: "user not found",
      });
    }
  });
});
app.get("/profile", (req, res, next) => {
  if (req.headers.authentication) {
    jwt.verify(
      req.headers.authentication.split(" ")[1],
      SERVER_SECRET,
      function (err, decoded) {
        if (!err) {
          console.log("user: ", decoded);
          userModel.findById(
            decoded.id,
            "name email phone gender createdOn",
            function (err, doc) {
              if (!err) {
                res.send({
                  status: 200,
                  profile: doc,
                });
              } else {
                res.status(500).send({
                  message: "server error",
                });
              }
            }
          );
        } else {
          res.status(401).send({
            message: err,
          });
          console.log(err);
        }
      }
    );
  }
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("server is running on: ", PORT);
});
