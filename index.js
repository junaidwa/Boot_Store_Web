const express = require("express");
const path = require("path");
const mongoose = require("mongoose");
const Schema = mongoose.Schema;
 const passportLocalMongoose = require('passport-local-mongoose');
 const flash = require("connect-flash");


 const session = require("express-session");
const passport = require("passport");


const app = express();
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));


app.use(express.urlencoded({ extended: true }));




//Passport Configuration
app.use(session({
  secret: "thisshouldbeabettersecret", // keep this in .env later
  resave: false,
  saveUninitialized: false
}));



app.use(flash()); // Use flash for temporary messages

app.use((req, res, next) => {
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  next();
});

//User Schema and Model


const userSchema = new Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true }
});

userSchema.plugin(passportLocalMongoose); // adds username, hash and salt fields
const User = mongoose.model('User', userSchema);






app.use(passport.initialize());
app.use(passport.session());

passport.use(User.createStrategy());
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());



const ejsmate = require("ejs-mate");
app.engine("ejs", ejsmate);

const port = 3000;

const bookSchema = new Schema({
  title: String,
  author: String,
  description: String,
  price: Number,
  image: String,
});

const Book = mongoose.model("Book", bookSchema);






// Mongo Connection




const Mongo_URL = "mongodb://127.0.0.1:27017/BookStore";
mongoose
  .connect(Mongo_URL)
  .then(() => {
    console.log("Mongo Connection Open");
  })
  .catch((err) => {
    console.log("Mongo Connection Error");
    console.log(err);
  });

// Insert Sample Book
// const book = new Book({
//   title: "Sample Book",
//   author: "John Doe",
//   description: "This is a sample book description.",
//   price: 19.99,
//   image: "sample-book.jpg",
// });
// book
//   .save()
//   .then(() => {
//     console.log("Sample Book Inserted");
//   })
//   .catch((err) => {
//     console.log("Error Inserting Sample Book");
//     console.log(err);
//   });



  //Insert Sample User
  // const user = new User({
  //   username: 'sampleuser',
  //   email: 'sampleuser@example.com',
  //   password: 'password123'
  // });
  // user

  //   .save()
  //   .then(() => {
  //     console.log("Sample User Inserted");
  //   })
  //   .catch((err) => {
  //     console.log("Error Inserting Sample User");
  //     console.log(err);
  //   });


app.post("/register", async (req, res, next) => {
  try {
    const { username, email, password } = req.body;
    const user = new User({ username, email });
    const registeredUser = await User.register(user, password);
    req.login(registeredUser, (err) => {
      if (err) return next(err);
      req.flash("success", "User Registered Successfully");
      res.redirect("/books");
    });
  } catch (err) {
    console.log("Registration Error:", err);
    req.flash("error", err.message);
    res.redirect("/register");

  }
});

app.post("/login", passport.authenticate("local", {
  failureRedirect: "/login",
  successRedirect: "/books"

}));

function isLoggedIn(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect("/login");
}



//for books
app.post("/books", async (req, res) => {
  const { title, author, description, price, image } = req.body;
  const book = new Book({ title, author, description, price, image });
  await book.save();
  req.flash("success", "Book Added Successfully");
  res.redirect("/books");
});




app.get("/", (req, res) => {
  res.render("BooksListing.ejs");
});
app.get("/books", async (req, res) => {
  try {
    const books = await Book.find(); // assuming you have a Book model
    res.render("BooksListing", { books }); // pass books to ejs
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching books");
  }
});

app.get("/new", (req, res) => {
  res.render("new");
});

app.get("/contact", (req, res) => {
  res.render("contact");
});
app.get("/about", (req, res) => {
  res.render("about");
});

app.get("/login", (req, res) => {
  res.render("user/login"); // no need for .ejs
});

app.get("/register", (req, res) => {
  res.render("user/signup"); // correct folder
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
