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

const methodOverride = require("method-override");
app.use(methodOverride("_method"));




const ejsmate = require("ejs-mate");
app.engine("ejs", ejsmate);

const port = 3000;

//Book Schema and Model
const bookSchema = new Schema({
  title: String,
  author: String,
  description: String,
  price: Number,
  image: String,
});

const Book = mongoose.model("Book", bookSchema);


const orderSchema = new Schema({
  // Customer Details
  customerName: { type: String, required: true },
  address: { type: String, required: true },
  city: { type: String, required: true },
  postalCode: { type: String, required: true },
  country: { type: String, required: true },

  // Cart / Books
  books: [
    {
      bookId: { type: Schema.Types.ObjectId, ref: "Book" },
      title: String,
      author: String,
      price: Number,
      quantity: { type: Number, default: 1 }
    }
  ],

  // Payment Info (only Cash on Delivery for now)
  paymentMethod: { 
    type: String, 
    default: "Cash on Delivery" 
  },

  // Auto-generated fields
  totalAmount: { type: Number, required: true },
  orderDate: { type: Date, default: Date.now },

  // Optional: keep status for future use
  status: { 
    type: String, 
    default: "Pending"   // you can remove if not needed
  }
});

const Order = mongoose.model("Order", orderSchema);
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

// Add to cart
app.post("/cart", async (req, res) => {
  const { bookId } = req.body;
  const book = await Book.findById(bookId);

  if (!book) {
    return res.redirect("/books");
  }

  // Initialize cart if not exist
  if (!req.session.cart) {
    req.session.cart = [];
  }

  // Add book to session cart
  req.session.cart.push(book);

  res.redirect("/cart"); // go to cart page
});

// Show cart
app.get("/cart", (req, res) => {
  const cart = req.session.cart || [];
  res.render("cart", { cart });
});

app.get("/checkout", (req, res) => {
  const cart = req.session.cart || [];
  res.render("checkout", { cart });
});

// Handle checkout




// app.post("/complete-order", (req, res) => {
//   req.flash("success", "Order placed successfully!");
//   req.session.cart = []; // clear cart after checkout
//   res.redirect("/books");
// });



app.post("/complete-order", async (req, res) => {
  try {
    const { name, address, city, postalCode, country, paymentMethod } = req.body;
    const cart = req.session.cart || [];

    if (cart.length === 0) {
      req.flash("error", "Cart is empty. Please add items before checkout.");
      return res.redirect("/cart");
    }

    // Calculate total
    const totalAmount = cart.reduce((sum, item) => sum + item.price * (item.quantity || 1), 0);

    // Create new Order
    const newOrder = new Order({
      customerName: name,
      address,
      city,
      postalCode,
      country,
      books: cart.map(item => ({
        bookId: item._id,
        title: item.title,
        author: item.author,
        price: item.price,
        quantity: item.quantity || 1
      })),
      paymentMethod: paymentMethod === "cod" ? "Cash on Delivery" : "Cash on Delivery", // only COD now
      totalAmount
    });

    await newOrder.save();

    // Clear cart after saving
    req.session.cart = [];

    req.flash("success", "Order placed successfully!");
    res.redirect("/books");

  } catch (err) {
    console.error("Order Error:", err);
    req.flash("error", "Something went wrong while placing your order.");
    res.redirect("/checkout");
  }
});


















// app.post("/cart", (req, res) => {
//   res.render("cart");
// });
// app.get("/cart", (req, res) => {
//   res.render("cart");
// }
// );
app.get("/logout",isLoggedIn, (req, res) => {
  req.logout((err) => {
    if (err) {
      return next(err);
    }
    req.flash("success", "Logged out successfully");
    res.redirect("/books");
  });
});

app.get("/books/:id/edit", isLoggedIn, async (req, res) => {
  const { id } = req.params;
  const book
  = await Book
    .findById(id);
  if (!book) {
    req.flash("error", "Book not found");
    return res.redirect("/books");
  }
  res.render("edit", { book });
});

app.post("/books/:id", isLoggedIn, async (req, res) => {
  const { id } = req.params;
  const { title, author, description, price, image } = req.body;
  await Book.findByIdAndUpdate(id, { title, author, description, price, image });
  req.flash("success", "Book Updated Successfully");
  res.redirect("/books");
} );


app.delete("/books/:id", isLoggedIn, async (req, res) => {
  const { id } = req.params;
  await Book.findByIdAndDelete(id);
  req.flash("success", "Book Deleted Successfully");
  res.redirect("/books");
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
