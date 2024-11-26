import React, { useCallback, useEffect, useState } from "react";
import ReactPlayer from "react-player";
import { useSocket } from "../context/SocketProvider";
import peer from "../service/peer";

const Room = () => {
  const socket = useSocket();
  const [remoteSocketId, setRemoteSocketId] = useState(null);
  const [myStream, setMyStream] = useState();
  const [remoteStream, setRemoteStream] = useState();

  const handleUserJoined = useCallback(({ email, id }) => {
    console.log("User with email", email, "joined");
    console.log("Socket ID is", id);
    setRemoteSocketId(id);
  }, []);

  const handleCallUser = useCallback(async () => {
    if (!remoteSocketId) {
      console.warn("Cannot call: No remote user in the room.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
      });

      const offer = await peer.getOffer();
      console.log("Calling user...");
      console.log("Remote ID is", remoteSocketId);
      socket.emit("user:call", { to: remoteSocketId, offer });
      setMyStream(stream);
    } catch (error) {
      console.error("Error during call setup:", error);
    }
  }, [remoteSocketId, socket]);

  const handleIncommingCall = useCallback(
    async ({ from, offer }) => {
      setRemoteSocketId(from);
      console.log("Incoming call from", from);
      console.log("Offer received:", offer);
      // You can handle the incoming call logic here
      const ans = await peer.getAnswer(offer);

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
      });

      setMyStream(stream);

      socket.emit("call:accepted", { to: from, ans });
    },
    [socket]
  );

  const handleCallAccepted = useCallback(
    ({ from, ans }) => {
      peer.setLocalDescription(ans);
      console.log("Call accepted!");
      for (const track of myStream.getTracks()) {
        peer.peer.addTrack(track, myStream);
      }
    },
    [myStream]
  );

  const handleNegoNeeded = useCallback(async () => {
    const offer = await peer.getOffer();
    socket.emit("peer:nego:needed", { offer, to: remoteSocketId });
  });

  const handleNegoNeedIncomming = useCallback(({ from, offer }) => {
    const ans = peer.getAnswer(offer);
    socket.emit("peer:nego:done", { to: from, ans });
  }, []);

  useEffect(() => {
    peer.peer.addEventListener("negotiationneeded", handleNegoNeeded);
    return () => {
      peer.peer.removeEventListener("negotiationneeded", handleNegoNeeded);
    };
  });

  useEffect(() => {
    peer.peer.addEventListener("track", async (ev) => {
      const remoteStream = ev.streams;
      setRemoteStream(remoteStream);
    });
  }, []);

  useEffect(() => {
    socket.on("user:joined", handleUserJoined);
    socket.on("incomming:call", handleIncommingCall);
    socket.on("call:accepted", handleCallAccepted);
    socket.on("peer:nego:needed", handleNegoNeedIncomming);

    return () => {
      socket.off("user:joined", handleUserJoined);
      socket.off("incomming:call", handleIncommingCall);
      socket.off("call:accepted", handleCallAccepted);
      socket.off("peer:nego:needed", handleNegoNeedIncomming);
    };
  }, [socket, handleUserJoined, handleIncommingCall, handleCallAccepted]);

  return (
    <div>
      <h1>Room</h1>
      <h4>{remoteSocketId ? "Connected" : "No One in the Room"}</h4>
      {remoteSocketId ? (
        <button onClick={handleCallUser}>CALL</button>
      ) : (
        <p>Waiting for someone to join...</p>
      )}
      {myStream && (
        <>
          <h1>My Stream</h1>
          <ReactPlayer
            playing
            height="100px"
            width="200px"
            muted
            url={myStream}
          />
        </>
      )}
      {remoteStream && (
        <>
          <h1>My Stream</h1>
          <ReactPlayer
            playing
            height="100px"
            width="200px"
            muted
            url={remoteStream}
          />
        </>
      )}
    </div>
  );
};

export default Room;
