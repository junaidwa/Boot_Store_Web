const express = require("express");
const path = require("path");

const app = express();
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

const ejsmate = require("ejs-mate");
app.engine("ejs", ejsmate);

const port = 3000;

app.get("/", (req, res) => {
  res.render("BooksListing.ejs");
});
app.get("/books", (req, res) => {
  res.render("BooksListing.ejs");
});
app.get('/new', (req, res) => {
  res.render('new');
});

app.get("/contact", (req, res) => {
  res.render("contact");
});
app.get("/about", (req, res) => {
    res.render("about");
});

app.get("/login", (req, res) => {
  res.render("user/login");   // no need for .ejs
});

app.get("/register", (req, res) => {
  res.render("user/signup");  // correct folder
});


app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
