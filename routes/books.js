const express = require("express");
const router = express.Router();
const multer = require('multer');
const { storage } = require('../CloudConfig');
const upload = multer({ storage: storage });
const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// Import the Book model from the main app
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

// Auth middleware
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

// Get all books
router.get("/", async (req, res) => {
  try {
    const books = await Book.find({});
    res.render("BooksListing", { books });
  } catch (err) {
    console.error(err);
    req.flash("error", "Error fetching books");
    res.redirect("/");
  }
});

// Get book details
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const book = await Book.findById(id);
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

// Add new book form
router.get("/new", isLoggedIn, isAdmin, (req, res) => {
  res.render("new");
});

// Create new book
router.post("/", upload.single("image"), isLoggedIn, isAdmin, async (req, res) => {
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
    res.redirect("/books/new");
  }
});

// Edit book form
router.get("/:id/edit", isLoggedIn, isAdmin, async (req, res) => {
  const { id } = req.params;
  const book = await Book.findById(id);
  if (!book) {
    req.flash("error", "Book not found");
    return res.redirect("/books");
  }
  res.render("edit", { book });
});

// Update book
router.put("/:id", isLoggedIn, isAdmin, upload.single("image"), async (req, res) => {
  try {
    const { id } = req.params;
    const { title, author, description, price, category } = req.body;
    
    const updateData = { title, author, description, price, category };
    
    if (req.file) {
      updateData.image = {
        url: req.file.path,
        filename: req.file.filename
      };
    }
    
    await Book.findByIdAndUpdate(id, updateData);
    req.flash("success", "Book Updated Successfully");
    res.redirect("/books");
  } catch (err) {
    console.error("Book Update Error:", err);
    req.flash("error", "Error updating book: " + err.message);
    res.redirect(`/books/${req.params.id}/edit`);
  }
});

// Delete book
router.delete("/:id", isLoggedIn, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await Book.findByIdAndDelete(id);
    req.flash("success", "Book Deleted Successfully");
    res.redirect("/books");
  } catch (err) {
    console.error("Book Delete Error:", err);
    req.flash("error", "Error deleting book: " + err.message);
    res.redirect("/books");
  }
});

module.exports = router;