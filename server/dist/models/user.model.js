"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserModel = void 0;
const mongoose_1 = require("mongoose");
const UserSchema = new mongoose_1.Schema({
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true },
    role: { type: String, enum: ["owner", "recruiter", "candidate"], default: "candidate" },
    profilePhotoUrl: { type: String },
    companyName: { type: String },
    companyLogoUrl: { type: String },
}, { timestamps: true });
exports.UserModel = (0, mongoose_1.model)("User", UserSchema);
//# sourceMappingURL=user.model.js.map