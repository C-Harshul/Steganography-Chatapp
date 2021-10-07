const path = require("path");
const http = require("http");
const express = require("express");
const socketio = require("socket.io");
const Filter = require("bad-words");
const axios = require("axios");
const {
  generateMessage,
  generateLocationMessage,
} = require("./utils/messages");
const {
  addUser,
  removeUser,
  getUser,
  getUsersInRoom,
} = require("./utils/users");
const app = express();
const server = http.createServer(app);
const io = socketio(server);

const port = process.env.PORT || 3000;
const publicDirectoryPath = path.join(__dirname, "../public");

app.use(express.static(publicDirectoryPath));

io.on("connection", (socket) => {
  console.log("New WebSocket connection");

  socket.on("join", ({ username, room }, callback) => {
    const { error, user } = addUser({ id: socket.id, username, room });
    if (error) {
      return callback(error);
    }
    socket.join(user.room);
    socket.emit("message", generateMessage("Admin", "Welcome!"));
    socket.broadcast
      .to(user.room)
      .emit(
        "message",
        generateMessage("Admin", `${user.username} has joined!`)
      );
    io.to(user.room).emit("roomData", {
      room: user.room,
      users: getUsersInRoom(user.room),
    });
    callback();
  });

  socket.on("sendMessage", (message, callback) => {
    const { user, error } = getUser(socket.id);
    if (error) return callback(error);
    console.log(user);
    const filter = new Filter();

    if (filter.isProfane(message)) {
      return callback("Profanity is not allowed!");
    }

    if (user.room === "hidden room") {
      console.log(message);
      var apiUrl = `https://steganography-project.herokuapp.com/hide/${message}`;
      io.to(user.room).emit("message",generateMessage ("BOT",`${user.username} is sending hidden message. Please hold on`))
      axios.get(apiUrl).then((res) => {
        console.log(res.data);
        io.to(user.room).emit(
          "message",
          generateMessage(user.username, res.data.timestamp)
        );
        callback();
      });
    }
    if (user.room !== "hidden room")
    io.to(user.room).emit("message", generateMessage(user.username, message));
    callback();
  });

  socket.on("sendLocation", (coords, callback) => {
    const { error, user } = getUser(socket.id);
    if (error) return callback(error);
    io.to(user.room).emit(
      "locationMessage",
      generateLocationMessage(
        user.username,
        `https://google.com/maps?q=${coords.latitude},${coords.longitude}`
      )
    );
    callback();
  });

  socket.on("disconnect", () => {
    const user = removeUser(socket.id);
    if (user)
      io.to(user.room).emit(
        "message",
        generateMessage("Admin", `${user.username} has left!`)
      );
    io.to(user.room).emit("roomData", {
      room: user.room,
      users: getUsersInRoom(user.room),
    });
  });
});

server.listen(port, () => {
  console.log(`Server is up on port ${port}!`);
});
