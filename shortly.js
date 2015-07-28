var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var bodyParser = require('body-parser');
var session = require('express-session');
var bcrypt = require('./node_modules/bcrypt-nodejs');
var Bookshelf = require('bookshelf');


var db = require('./app/config');
var Users = require('./app/collections/users');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');

var app = express();
var sess;

// https://codeforgeek.com/2014/09/manage-session-using-node-js-express-4/
// http://codetheory.in/using-the-node-js-bcrypt-module-to-hash-and-safely-store-passwords/

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(partials());
// Parse JSON (uniform resource locators)
app.use(bodyParser.json());
// Parse forms (signup/login)
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));
app.use(session({secret: 'ssshhhhh'}));


app.get('/', 
function(req, res) {
  if (req.session.user) {
    res.render('index')
  } else {
    req.session.error = 'Access denied!';
    res.redirect('/login');
  }

  // if(true) {
  //   res.render('index');
  // } else {
  //   res.render('login');
  // }
});

app.get('/login', 
function(req, res) {
  res.render('login');
});

app.get('/create', 
function(req, res) {
  if (req.session.user) {
    res.render('index')
  } else {
    req.session.error = 'Access denied!';
    res.redirect('/login');
  }

  // res.render('index');
});

app.get('/links', 
function(req, res) {

  if (req.session.user) {
    Links.reset().fetch().then(function(links) {
      res.send(200, links.models);
    });
  } else {
    req.session.error = 'Access denied!';
    res.redirect('/login');
  }

  // Links.reset().fetch().then(function(links) {
  //   res.send(200, links.models);
  // });
});

app.post('/links', 
function(req, res) {
  var uri = req.body.url;

  if (!util.isValidUrl(uri)) {
    console.log('Not a valid url: ', uri);
    return res.send(404);
  }

  new Link({ url: uri }).fetch().then(function(found) {
    if (found) {
      res.send(200, found.attributes);
    } else {
      util.getUrlTitle(uri, function(err, title) {
        if (err) {
          console.log('Error reading URL heading: ', err);
          return res.send(404);
        }

        var link = new Link({
          url: uri,
          title: title,
          base_url: req.headers.origin
        });

        link.save().then(function(newLink) {
          Links.add(newLink);
          res.send(200, newLink);
        });
      });
    }
  });
});

/************************************************************/
// Write your authentication routes here
/************************************************************/

app.get('/signup', 
function(req, res) {
  res.render('signup');
});

app.get('/logout', 
function(req, res) {
  req.session.destroy();
  res.redirect('/login');
});

app.post('/signup', function(request, response) {
 
    var username = request.body.username;
    var password = request.body.password;
    // var salt = bcrypt.genSaltSync(10);
    // var hash = bcrypt.hashSync(password, salt);

    //Insert into DB for new user

    // User.set({username: username, hash: hash, salt: salt});

    new User({
          'username': username,
          'password': password
          // 'hash': hash,
          // 'salt': salt
      }).save().then(function(){
        sess=request.session;
        sess.user = username;
        response.redirect('/index');
      });


    // var userObj = db.users.findOne({ username: username, password: hash });
     
    // if(userObj){
    //   request.session.regenerate(function(){
    //     request.session.user = userObj.username;
    //     response.redirect('/restricted');
    //   });
    // }
    // else {
    //   res.redirect('login');
    // }
 
});

app.post('/login', function(request, response) {
 
    var username = request.body.username;
    var password = request.body.password;
    // var salt = request.body.salt;
    // var hash = bcrypt.hashSync(password, salt);

    //query DB to check whether username exists. If it does, check whether password matches

    db.knex('users')
      .where('username', '=', username)
      .then(function(data) {
        if (data['0'] && data['0']['username']) {
          var foundUser = data['0']['username'];
          var foundPassword = data['0']['password'];

          if (username === foundUser && foundPassword === password) {
            sess=request.session;
            sess.user = username;
            response.redirect('/index');
          }
        }
      })
        

    //If username or password does not exist, redirect to /login

    //if it does, redirect to index?


    // var userObj = db.users.findOne({ username: username, password: hash });
     
    // if(userObj){
    //     request.session.regenerate(function(){
    //         request.session.user = userObj.username;
    //         response.redirect('/restricted');
    //     });
    // }
    // else {
    //     res.redirect('login');
    // }
 
});

/************************************************************/
// Handle the wildcard route last - if all other routes fail
// assume the route is a short code and try and handle it here.
// If the short-code doesn't exist, send the user to '/'
/************************************************************/

app.get('/*', function(req, res) {
  new Link({ code: req.params[0] }).fetch().then(function(link) {
    if (!link) {
      res.redirect('/');
    } else {
      var click = new Click({
        link_id: link.get('id')
      });

      click.save().then(function() {
        db.knex('urls')
          .where('code', '=', link.get('code'))
          .update({
            visits: link.get('visits') + 1,
          }).then(function() {
            return res.redirect(link.get('url'));
          });
      });
    }
  });
});


  // $('.logout').on('click', function(){
  //   app.post('/logout', function(req, res) {
  //     res.redirect('/logout')
  //   })
  // });



console.log('Shortly is listening on 4568');
app.listen(4568);
