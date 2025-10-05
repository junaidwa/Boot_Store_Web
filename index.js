const express = require("express");
const path = require("path");
const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const passportLocalMongoose = require("passport-local-mongoose");
const flash = require("connect-flash");
require("dotenv").config();


//Multer
const multer  = require('multer')
const { storage } = require('./CloudConfig');
const { cloudinary } = require("./CloudConfig");

const upload = multer({ storage: storage });
// If you want to store files locally instead of cloud, use this:
// //
// const upload = multer({ dest: 'uploads/' })

const session = require("express-session");
const passport = require("passport");
const methodOverride = require("method-override");
const ejsmate = require("ejs-mate");
const { url } = require("inspector");

const app = express();
const port = 3000;

// -------------------- View Engine --------------------
app.engine("ejs", ejsmate);
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// -------------------- Middleware --------------------
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride("_method"));

// -------------------- Session & Passport Setup --------------------
app.use(
  session({
    secret: "thisshouldbeabettersecret", // put in .env
    resave: false,
    saveUninitialized: false,
  })
);

app.use(passport.initialize());
app.use(passport.session());

app.use(flash()); // flash AFTER session

// -------------------- MongoDB Connection --------------------
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

// -------------------- Schemas & Models --------------------
const userSchema = new Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  role: { type: String, enum: ["user", "admin"], default: "user" },
});
userSchema.plugin(passportLocalMongoose);
const User = mongoose.model("User", userSchema);

passport.use(User.createStrategy());
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

// const bookSchema = new Schema({
//   title: String,
//   author: String,
//   description: String,
//   price: Number,
//   image: String,
// });
// const Book = mongoose.model("Book", bookSchema);
const bookSchema = new Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  author: {
    type: String,
    required: true,
    trim: true
  },
  description: String,
  price: {
    type: Number,
    required: true,
    min: 0
  },
  image:{
    url: String,
    filename: String
  },

  // 👇 New field for category
  category: {
    type: String,
    enum: [
      "Fiction",
      "Non-fiction",
      "Science",
      "History",
      "Islamic",
      "Kids",
      "Comics",
      "Biography",
      "Education",
      "Technology"
    ],
    required: true
  }
});

const Book = mongoose.model("Book", bookSchema);


const orderSchema = new Schema({
  customerName: { type: String, required: true },
  address: { type: String, required: true },
  city: { type: String, required: true },
  postalCode: { type: String, required: true },
  country: { type: String, required: true },
  books: [
    {
      bookId: { type: Schema.Types.ObjectId, ref: "Book" },
      title: String,
      author: String,
      price: Number,
      quantity: { type: Number, default: 1 },
    },
  ],
  paymentMethod: { type: String, default: "Cash on Delivery" },
  totalAmount: { type: Number, required: true },
  orderDate: { type: Date, default: Date.now },
  status: { type: String, default: "Pending" },
});
const Order = mongoose.model("Order", orderSchema);

// -------------------- Locals Middleware --------------------
app.use((req, res, next) => {
  res.locals.currentUser = req.user || null;
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  next();
});

// -------------------- Auth Helpers --------------------
function isLoggedIn(req, res, next) {
  if (req.isAuthenticated()) return next();
  req.flash("error", "You must be logged in to perform this action.");
  res.redirect("/login");
}

function isAdmin(req, res, next) {
  if (req.isAuthenticated() && req.user.role === "admin") return next();
  req.flash("error", "You must be an admin to perform this action.");
  res.redirect("/books");
}

// -------------------- Routes --------------------
// Register
app.post("/register", async (req, res, next) => {
  try {
    const { username, email, password } = req.body;
    const adminEmails = (process.env.ADMIN_EMAILS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const adminUsernames = (process.env.ADMIN_USERNAMES || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const role =
      adminEmails.includes(email) || adminUsernames.includes(username)
        ? "admin"
        : "user";

    const user = new User({ username, email, role });
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

// Login
app.post(
  "/login",
  passport.authenticate("local", {
    failureRedirect: "/login",
    failureFlash: true,
    successRedirect: "/books",
  })
);

// Logout
app.get("/logout", isLoggedIn, (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    req.flash("success", "Logged out successfully");
    res.redirect("/books");
  });
});

// Secret route example
app.get("/secret", (req, res, next) => {
  if (!req.isAuthenticated()) {
    const err = new Error("You must be logged in to view this page!");
    err.status = 401;
    return next(err);
  }
  res.send("Secret content");
});

// Books
app.get("/home", async (req, res) => {
  try {
    const books = await Book.find();
    res.render("home.ejs");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error in Home Page");
  }
});

// 📚 Route to show all books
// app.get("/books", async (req, res) => {
//   try {
//     const books = await Book.find();
//     res.render("BooksListing", { books });
//   } catch (err) {
//     console.error(err);
//     res.status(500).send("Error fetching books");
//   }
// });


// // 🏷️ Route to show books by category
// app.get("/books/category/:category", async (req, res) => {
//   try {
//     const category = req.params.category;
//     const books = await Book.find({ category });

//     res.render("BooksListing", { books, selectedCategory: category });
//   } catch (err) {
//     console.error(err);
//     res.status(500).send("Error fetching books by category");
//   }
// });


// 📚 All books
app.get("/books", async (req, res) => {
  try {
    const books = await Book.find();
    res.render("BooksListing", { books, selectedCategory: "All" }); // 👈 added selectedCategory
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching books");
  }
});

// 🏷️ Category route
app.get("/books/category/:category", async (req, res) => {
  try {
    const category = req.params.category;
    const books = await Book.find({ category });
    res.render("BooksListing", { books, selectedCategory: category });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching books by category");
  }
});
//Details of books
  //  <a href="/books/<%= book._id %>/details" class="btn btn-info btn-sm">Details</a>
app.get("/books/:id/details", async (req, res) => {
  try {
    const { id } = req.params;
    const book
  = await Book
      .findById(id);
    if (!book) {
      req.flash("error", "Book not found");
      return res.redirect("/books");
    }
    res.render("bookDetails", { book });
  } catch (err) {
    console.error(err);
    req.flash("error", "Error fetching book details");
    res.redirect("/books");
  }
});




// app.post("/books", upload.single("image"), isLoggedIn, isAdmin, async (req, res) => {
//   try {
//     const { title, author, description, price, category } = req.body;
//     const image = req.file.path; // Get the uploaded image path
//     const book = new Book({ title, author, description, price, image, category });
//     await book.save();
//     req.flash("success", "Book Added Successfully");
//     res.redirect("/books");
//   } catch (err) {
//     console.error("Book Add Error:", err);
//     req.flash("error", "Error adding book: " + err.message);
//     res.redirect("/new");
//   }
// });
//For stroing online url to iamges
app.post("/books", upload.single("image"), isLoggedIn, isAdmin, async (req, res) => {
  try {
    const { title, author, description, price, category } = req.body;

    const book = new Book({
      title,
      author,
      description,
      price,
      category,
    });

    if (req.file) {
      book.image = {
        url: req.file.path,      // Cloudinary URL
        filename: req.file.filename,  // Cloudinary file name
      };
    }

    await book.save();
    req.flash("success", "Book Added Successfully");
    res.redirect("/books");
  } catch (err) {
    console.error("Book Add Error:", err);
    req.flash("error", "Error adding book: " + err.message);
    res.redirect("/new");
  }
});



app.get("/new", isLoggedIn, isAdmin, (req, res) => {
  res.render("new");
});

app.get("/books/:id/edit", isLoggedIn, isAdmin, async (req, res) => {
  const { id } = req.params;
  const book = await Book.findById(id);
  if (!book) {
    req.flash("error", "Book not found");
    return res.redirect("/books");
  }
  res.render("edit", { book });
});
//Update route

// app.put("/books/:id", isLoggedIn, isAdmin, async (req, res) => {
//   const { id } = req.params;
//   const { title, author, description, price, image, category } = req.body;
//   await Book.findByIdAndUpdate(id, { title, author, description, price, image, category });
//   req.flash("success", "Book Updated Successfully");
//   res.redirect("/books");
// });

// //Update route with edit image option
// app.put("/books/:id", isLoggedIn, isAdmin, upload.single("image"), async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { title, author, description, price, category } = req.body;

//     // Find the existing book in DB
//     const book = await Book.findById(id);

//     if (!book) {
//       req.flash("error", "Book not found");
//       return res.redirect("/books");
//     }

//     // Update basic text fields
//     book.title = title;
//     book.author = author;
//     book.description = description;
//     book.price = price;
//     book.category = category;

//     // If a new image is uploaded, replace the old one
//     if (req.file) {
//       // Delete the old image from Cloudinary (optional but recommended)
//       if (book.image && book.image.filename) {
//         await cloudinary.uploader.destroy(book.image.filename);
//       }

//       // Add the new image info
//       book.image = {
//         url: req.file.path,
//         filename: req.file.filename,
//       };
//     }

//     // Save updates
//     await book.save();
//     req.flash("success", "Book Updated Successfully");
//     res.redirect("/books");
//   } catch (err) {
//     console.error("Book Update Error:", err);
//     req.flash("error", "Error updating book: " + err.message);
//     res.redirect(`/books/${req.params.id}/edit`);
//   }
// });
app.put("/books/:id", isLoggedIn, isAdmin, upload.single("image"), async (req, res) => {
  try {
    const { id } = req.params;
    const { title, author, description, price, category } = req.body;

    // find existing
    const book = await Book.findById(id);
    if (!book) {
      req.flash("error", "Book not found");
      return res.redirect("/books");
    }

    // Update fields (ensure price is Number)
    if (title) book.title = title;
    if (author) book.author = author;
    if (description) book.description = description;
    if (price !== undefined) book.price = Number(price);
    // If category provided, update it; otherwise keep existing (prevents validation failure)
    if (category) {
      book.category = category;
    }

    // If a new image is uploaded: delete old from Cloudinary and set new image
    if (req.file) {
      if (book.image && book.image.filename) {
        try {
          await cloudinary.uploader.destroy(book.image.filename);
        } catch (delErr) {
          console.warn("Cloudinary delete warning:", delErr.message);
        }
      }
      book.image = {
        url: req.file.path,
        filename: req.file.filename
      };
    }

    await book.save();
    req.flash("success", "Book Updated Successfully");
    res.redirect("/books");
  } catch (err) {
    console.error("Book Update Error:", err);
    req.flash("error", "Error updating book: " + err.message);
    res.redirect(`/books/${req.params.id}/edit`);
  }
});







app.delete("/books/:id", isLoggedIn, isAdmin, async (req, res) => {
  const { id } = req.params;
  await Book.findByIdAndDelete(id);
  req.flash("success", "Book Deleted Successfully");
  res.redirect("/books");
});

// Cart
app.post("/cart", isLoggedIn, async (req, res) => {
  const { bookId } = req.body;
  const book = await Book.findById(bookId);
  if (!book) return res.redirect("/books");

  if (!req.session.cart) req.session.cart = [];
  req.session.cart.push(book);

  res.redirect("/cart");
});

app.get("/cart", isLoggedIn, (req, res) => {
  const cart = req.session.cart || [];
  res.render("cart", { cart });
});

app.post("/cart/remove", isLoggedIn, (req, res) => {
  const { bookId } = req.body;
  if (!req.session.cart) return res.redirect("/cart");

  req.session.cart = req.session.cart.filter(
    (item) => item._id.toString() !== bookId
  );
  req.flash("success", "Book Removed from Cart Successfully");
  res.redirect("/cart");
});

app.get("/checkout", isLoggedIn, (req, res) => {
  const cart = req.session.cart || [];
  res.render("checkout", { cart });
});

app.post("/complete-order", async (req, res) => {
  try {
    const { name, address, city, postalCode, country, paymentMethod } = req.body;
    const cart = req.session.cart || [];
    if (cart.length === 0) {
      req.flash("error", "Cart is empty. Please add items before checkout.");
      return res.redirect("/cart");
    }

    const totalAmount = cart.reduce(
      (sum, item) => sum + item.price * (item.quantity || 1),
      0
    );

    const newOrder = new Order({
      customerName: name,
      address,
      city,
      postalCode,
      country,
      books: cart.map((item) => ({
        bookId: item._id,
        title: item.title,
        author: item.author,
        price: item.price,
        quantity: item.quantity || 1,
      })),
      paymentMethod:
        paymentMethod === "cod" ? "Cash on Delivery" : "Cash on Delivery",
      totalAmount,
    });

    await newOrder.save();
    req.session.cart = []; // clear cart

    req.flash("success", "Order placed successfully!");
    res.redirect("/books");
  } catch (err) {
    console.error("Order Error:", err);
    req.flash("error", "Something went wrong while placing your order.");
    res.redirect("/checkout");
  }
});

// Static pages
app.get("/contact", (req, res) => res.render("contact"));
app.get("/about", (req, res) => res.render("about"));
app.get("/login", (req, res) => res.render("user/login"));
app.get("/register", (req, res) => res.render("user/signup"));
//We want users data, books data and orders data to be visible on dashboard
app.get("/dashboard", isLoggedIn, isAdmin, async (req, res) => {
  try {
    const users = await User.find();
    const books = await Book.find();
    const orders = await Order.find().populate("books.bookId");
    res.render("dashboard", { users, books, orders });
  } catch (err) {
    console.error(err);
    req.flash("error", "Unable to load dashboard data.");
    res.redirect("/books");
  }
});

// app.get("/dashboard", isLoggedIn, isAdmin, (req, res) => {
//   res.render("dashboard");

// });

// -------------------- Error Handlers --------------------
// 404 - Page not found
app.use((req, res) => {
  res.status(404).render("error", { message: "Page Not Found" });
});

// General error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).render("error", {
    message: err.message || "Something went wrong!",
  });
});

// -------------------- Server --------------------
app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
