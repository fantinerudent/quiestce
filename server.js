"use strict";

const express = require("express");
// var AWS = require('aws-sdk');
// var https = require('https');
// var agent = new https.Agent({
//    maxSockets: 25
// });
const app = express();
// utilisation du module mongoDB
const MongoClient = require("mongodb").MongoClient;
const bodyParser = require("body-parser");
// utilisation du module complémentaire qui génère un identifiant unique.
const connectMongo = require("connect-mongo");
// gestion des sessions:
const uuidv1 = require("uuid/v1");
const expressSession = require("express-session");
const MongoStore = connectMongo(expressSession);
var cookieSession = require("cookie-session");
// utilisation de chalk pour rendre l'exercice plus lisible:
const chalk = require("chalk");
var error = chalk.bold.red;
const ONE_HOUR = 1000 * 60 * 60;
const SESSION_lifeTime = ONE_HOUR;

const session = {
  name: "sid",
  cookie: {
    maxAge: SESSION_lifeTime
  },
  rolling: true,
  store: new MongoStore({
    url: "mongodb://localhost:27017/jeu_multi"
  }),
  secret: "Alawaléguainbistouly",
  saveUninitialized: true,
  resave: false
};

app.use(expressSession(session));
// require('http').globalAgent.maxSockets = 2
// utilisation du module pug :
app.set("view engine", "pug");
app.set("views", "./views");

// déclaration de l'emplacement des fichiers statiques:
app.use("/img", express.static(__dirname + "/src/img"));
app.use("/css", express.static(__dirname + "/public/css"));
app.use("/js", express.static(__dirname + "/src/js"));

app.use(bodyParser.urlencoded({ extended: false }));

function strUcFirst(a) {
  return (a + "").charAt(0).toUpperCase() + a.substr(1);
}

//
// middleware fonction :
//
// si l'utilisateur n'est pas authentifié;

const redirectionLogin = (req, res, next) => {
  if (!req.session.userId) {
    res.redirect("/login");
  } else {
    next();
  }
};
const redirectionGame = (req, res, next) => {
  if (req.session.userId) {
    res.redirect("/room");
  } else {
    next();
  }
};

app.get("/", redirectionLogin, (req, res) => {
    res.render("salle", {
        roomName: req.params.room,
        pseudonyme: req.session.pseudonyme,
        sourceAvatar: req.session.avatar
      });
});

app.get("/login", redirectionGame, (req, res) => {
  res.render("login");
});

// app.get("/salle", redirectionLogin, (req, res) => {
    
// });

app.get("/inscription", redirectionGame, (req, res) => {
  res.render("inscription");
});


const rooms = [ ];

app.post("/room", redirectionLogin, (req, res) => {
    rooms.push(req.body.nouvelleRoom)
    console.log(rooms, 'rooms');
    ioServer.emit("room-created", rooms)
    res.redirect(req.body.nouvelleRoom);
});

app.get("/:room", redirectionLogin, (req, res) => {
  res.render("room", {
    roomName: req.params.room,
    pseudonyme: strUcFirst(req.session.pseudonyme),
    sourceAvatar: req.session.avatar
  });
  console.log("je suis dans une salle crée");
});

app.post("/login", redirectionGame, (req, res) => {
  MongoClient.connect(
    "mongodb://localhost:27017",
    { useUnifiedTopology: true },
    (err, client) => {
      let db = client.db("jeu_multi");
      let collection = db.collection("utilisateurs");
      collection
        .find({ pseudonyme: req.body.pseudonyme })
        .toArray(function(err, result) {
          if (err) {
            console.log(
              error("impossible de se connecter à la collection de données ")
            );
            client.close();
          }

          if (!result.length) {
            res.render("login", {
              message:
                "le pseudo renseigné n'est pas valable, veuillez vous inscrire"
            });
          } else {
            const infoUser = result[0];
            // si le pseudo et le mot de passe entrés correspondent à ce que j'ai en base de données, ca signifie que l'utilisateur est identifié, j'utilise l'UUID généré pour l'assigné ET a la requete session & à l'user.
            if (req.body.password === infoUser.password) {
              req.session.pseudonyme = req.body.pseudonyme;
              req.session.userId = uuidv1();
              infoUser.userId = req.session.userId;
              var avatar = infoUser.avatar;
              var sourceAvatar = "/img/avatars/" + avatar + ".png";
              req.session.avatar = sourceAvatar;
              // res.render("login", {
              //   userId: req.session.uuid,
              //   pseudonyme: strUcFirst(req.body.pseudonyme),
              //   sourceAvatar
              // });
              res.redirect("/");
            } else {
              res.render("login", {
                message: "mauvais mot de passe"
              });
              client.close();
            }
          }
        });
    }
  );
});

app.post("/inscription", redirectionGame, (req, res) => {
  //connection à mongodb
  MongoClient.connect(
    "mongodb://localhost:27017",
    { useUnifiedTopology: true },
    (err, client) => {
      if (err) {
        console.log(error("Impossible de se connecter à la base de données"));
      }
      // si connection a mongodb reussie, alors je defini la database utilisée ainsi que la collection.
      let db = client.db("jeu_multi");
      let collection = db.collection("utilisateurs");
      collection
        .find({ pseudonyme: req.body.pseudonyme })
        .toArray(function(err, result) {
          if (err) {
            console.log(
              error("impossible de se connecter à la collection de données ")
            );
          }
          if (!result.length) {
            let insertion = {};
            insertion.pseudonyme = req.body.pseudonyme;
            insertion.password = req.body.password;
            insertion.uuid = uuidv1();
            req.session.uuid = insertion.uuid;

            // ICI JE DOIS GERER LE CHOIX DE LAVATAR LORS DE LINSCRIPTION.
            insertion.avatar = "poop";
            req.session.pseudonyme = req.body.pseudonyme;
            var sourceAvatar = "/img/avatars/" + insertion.avatar + ".png";
            collection.insertOne(insertion, (err, result) => {
              res.render("login", {
                message:
                  "vous êtes inscrits, veuillez maintenant vous connecter."
              });
            });
          } else {
            res.render("login", {
              message:
                "le nom d'utilisateur existe déjà; veuillez vous connecter."
            });
          }
        });
    }
  );
});

const HTTPserver = app.listen("8000", (req, res) => {
  console.log(chalk.bgMagenta("serveurHTPP connecté sur le port 8000"));
});

const io = require("socket.io");
const ioServer = io(HTTPserver);


ioServer.on("connect", function(ioSocket){

   ioSocket.on("room-joigned", ({socketId, room}) => {
        console.log("lasocket ", socketId, "est dans la room : " , room) 
    })

    ioSocket.on('room_to_remove', (data) =>  {
        console.log(data)
    })

    ioSocket.on('player-number', ({number, boutonDisabled}) => { 
        ioServer.emit('affichage-player-number', {number, boutonDisabled})
    })


})

