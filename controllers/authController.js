const User = require("../models/User");
const bcrypt = require("bcrypt");
const generateToken = require("../utils/generateToken");


// Register

exports.register = async(req,res)=>{

const {name,email,password}=req.body;


try{

const exists = await User.findOne({email});

if(exists){

return res.status(400).json({
message:"User already exists"
});

}


const hash = await bcrypt.hash(password,10);


const user = await User.create({

name,
email,
password:hash

});


res.json({

message:"Account created",

token:generateToken(user._id),

user:user

});


}catch(error){

res.status(500).json({
message:error.message
});

}

};



// Login

exports.login = async(req,res)=>{


const {email,password}=req.body;


const user = await User.findOne({email});


if(!user){

return res.status(404).json({
message:"User not found"
});

}


const match = await bcrypt.compare(
password,
user.password
);


if(!match){

return res.status(401).json({
message:"Wrong password"
});

}


res.json({

message:"Login successful",

token:generateToken(user._id),

user:user

});


};
