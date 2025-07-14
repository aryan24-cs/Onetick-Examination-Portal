import express, { Request, Response, NextFunction } from "express";
import mongoose, { Types } from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import nodemailer from "nodemailer";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Joi from "joi";
import { v4 as uuidv4 } from "uuid";
import rateLimit from "express-rate-limit";

dotenv.config();

const app = express();

// Middleware
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  })
);
app.use(express.json());
app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader("Content-Type", "application/json");
  next();
});

// Rate Limiting (commented out as in your original code)
// const limiter = rateLimit({
//   windowMs: 15 * 60 * 1000,
//   max: 100,
// });
// app.use(limiter);

// MongoDB Connection
const connectDB = async () => {
  try {
    await mongoose.connect(
      process.env.MONGO_URI || "mongodb://localhost:27017/testSystem",
      {
        dbName: "testSystem",
      }
    );
    console.log("MongoDB connected");
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminEmail || !adminPassword) {
      console.error("Missing ADMIN_EMAIL or ADMIN_PASSWORD in .env");
      process.exit(1);
    }
    console.log("Checking admin account:", { adminEmail });
    let admin = await Admin.findOne({ email: adminEmail });
    if (!admin) {
      console.log("No admin found, creating new admin account");
      const hashedPassword = await bcrypt.hash(adminPassword, 10);
      admin = new Admin({ email: adminEmail, password: hashedPassword });
      await admin.save();
      console.log(`Admin account created for email: ${adminEmail}`);
    } else {
      const isMatch = await bcrypt.compare(adminPassword, admin.password);
      if (!isMatch) {
        console.log("Admin password in .env has changed, updating password");
        admin.password = adminPassword;
        await admin.save();
        console.log(`Admin password updated for email: ${adminEmail}`);
      }
    }
  } catch (error) {
    console.error("MongoDB connection error:", error);
    process.exit(1);
  }
};
connectDB();

// Nodemailer Setup
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
});

const sendOTPEmail = async (to: string, otp: string) => {
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to,
      subject: "Your OTP for Registration",
      html: `<div style="font-family: Arial, sans-serif; padding: 20px;"><h2>OTP Verification</h2><p>Your OTP is <strong>${otp}</strong>. It is valid for 10 minutes.</p></div>`,
    });
    console.log(`OTP email sent to ${to}`);
  } catch (error) {
    console.error(`Failed to send OTP email to ${to}:`, error);
    throw new Error("Failed to send OTP email");
  }
};

const sendTestNotification = async (
  to: string,
  testName: string,
  date: Date,
  duration: number
) => {
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to,
      subject: `New Test: ${testName}`,
      html: `<div style="font-family: Arial, sans-serif; padding: 20px;"><h2>New Test Scheduled</h2><p>A new test "${testName}" is scheduled for ${date.toLocaleString(
        "en-IN",
        { timeZone: "Asia/Kolkata" }
      )}. Duration: ${duration} minutes.</p></div>`,
    });
    console.log(`Test notification sent to ${to}`);
  } catch (error) {
    console.error(`Failed to send test notification to ${to}:`, error);
    throw new Error("Failed to send test notification");
  }
};

const sendResultNotification = async (
  to: string,
  testName: string,
  score: number,
  total: number
) => {
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to,
      subject: `Test Result: ${testName}`,
      html: `<div style="font-family: Arial, sans-serif; padding: 20px;"><h2>Test Result</h2><p>You scored ${score}/${total} in ${testName}.</p></div>`,
    });
    console.log(`Result notification sent to ${to}`);
  } catch (error) {
    console.error(`Failed to send result notification to ${to}:`, error);
    throw new Error("Failed to send result notification");
  }
};

// Mongoose Models
interface IAdmin extends mongoose.Document {
  _id: Types.ObjectId;
  email: string;
  password: string;
  comparePassword(password: string): Promise<boolean>;
}

interface IStudent extends mongoose.Document {
  studentId: string;
  name: string;
  email: string;
  password: string;
  profile: { dob: string; phone: string; address: string };
  otp: string | null;
  otpExpires: Date | null;
  comparePassword(password: string): Promise<boolean>;
}

interface IQuestion extends mongoose.Document {
  questionId: string;
  question: string;
  code?: string;
  options: string[];
  correctAnswer: number;
}

interface ITest extends mongoose.Document {
  testId: string;
  name: string;
  date: Date;
  duration: number;
  questionIds: Types.ObjectId[];
}

interface IResult extends mongoose.Document {
  testId: string;
  studentId: string;
  answers: number[];
  score: number;
  totalQuestions: number;
}

const QuestionSchema = new mongoose.Schema({
  questionId: { type: String, required: true, unique: true },
  question: { type: String, required: true },
  code: { type: String, default: "" },
  options: [{ type: String, required: true }],
  correctAnswer: { type: Number, required: true },
});

const AdminSchema = new mongoose.Schema({
  _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
});

AdminSchema.pre("save", async function (next) {
  if (this.isModified("password")) {
    console.log("Hashing admin password for:", this.email);
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});

AdminSchema.methods.comparePassword = async function (password: string) {
  console.log("Comparing password for admin:", this.email);
  return bcrypt.compare(password, this.password);
};

const StudentSchema = new mongoose.Schema({
  studentId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  profile: { dob: String, phone: String, address: String },
  otp: { type: String, default: null },
  otpExpires: { type: Date, default: null },
});

StudentSchema.pre("save", async function (next) {
  if (this.isModified("password")) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});

StudentSchema.methods.comparePassword = async function (password: string) {
  return bcrypt.compare(password, this.password);
};

const TestSchema = new mongoose.Schema({
  testId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  date: { type: Date, required: true },
  duration: { type: Number, required: true },
  questionIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Question" }],
});

const ResultSchema = new mongoose.Schema({
  testId: { type: String, required: true },
  studentId: { type: String, required: true },
  answers: [Number],
  score: Number,
  totalQuestions: Number,
});

const Admin = mongoose.model<IAdmin>("Admin", AdminSchema);
const Student = mongoose.model<IStudent>("Student", StudentSchema);
const Question = mongoose.model<IQuestion>("Question", QuestionSchema);
const Test = mongoose.model<ITest>("Test", TestSchema);
const Result = mongoose.model<IResult>("Result", ResultSchema);

// Joi Schemas
const registerSchema = Joi.object({
  name: Joi.string().min(3).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  dob: Joi.string().required(),
  phone: Joi.string().min(10).required(),
  address: Joi.string().required(),
});

const otpSchema = Joi.object({
  email: Joi.string().email().required(),
  otp: Joi.string().length(6).required(),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

const resetPasswordSchema = Joi.object({
  email: Joi.string().email().required(),
  newPassword: Joi.string().min(6).required(),
  secretKey: Joi.string().required(),
});

const questionSchema = Joi.object({
  question: Joi.string().min(3).required(),
  code: Joi.string().allow("").optional(),
  options: Joi.array().items(Joi.string().min(1)).min(2).max(10).required(),
  correctAnswer: Joi.number().min(0).max(9).required(),
});

const testSchema = Joi.object({
  name: Joi.string().min(3).required(),
  date: Joi.date().iso().required(),
  duration: Joi.number().min(1).required(),
  questionIds: Joi.array().items(Joi.string()).min(1).required(),
});

const submitSchema = Joi.object({
  testId: Joi.string().required(),
  answers: Joi.array().items(Joi.number()).required(),
});

const profileSchema = Joi.object({
  name: Joi.string().min(3).required(),
  dob: Joi.string().required(),
  phone: Joi.string().min(10).required(),
  address: Joi.string().required(),
});

// Middleware
interface AuthRequest extends Request {
  user?: { id: string; role: string };
}

const authMiddleware = (role: "admin" | "student") => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      console.log("No token provided in request");
      return res.status(401).json({ message: "No token provided" });
    }
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || "secret") as {
        id: string;
        role: string;
      };
      console.log("Decoded token:", { id: decoded.id, role: decoded.role });
      if (decoded.role !== role) {
        console.log(
          `Access denied: Expected role ${role}, got ${decoded.role}`
        );
        return res.status(403).json({ message: "Access denied" });
      }
      req.user = decoded;
      next();
    } catch (error) {
      console.error("Token verification error:", error);
      res.status(401).json({ message: "Invalid token" });
    }
  };
};

const validate = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error } = schema.validate(req.body);
    if (error) {
      console.log("Validation error:", error.details[0].message);
      return res.status(400).json({ message: error.details[0].message });
    }
    next();
  };
};

const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error("Server error:", err.stack);
  res
    .status(500)
    .json({ message: "Internal server error", error: err.message });
};

// Routes
app.post(
  "/api/auth/register",
  validate(registerSchema),
  async (req: Request, res: Response) => {
    const { name, email, password, dob, phone, address } = req.body;
    try {
      console.log("Register attempt:", { email });
      let student = await Student.findOne({ email });
      if (student) {
        console.log("Email already exists:", email);
        return res.status(400).json({ message: "Email already exists" });
      }
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const otpExpires = new Date(Date.now() + 10 * 60 * 1000);
      student = new Student({
        studentId: uuidv4(),
        name,
        email,
        password,
        profile: { dob, phone, address },
        otp,
        otpExpires,
      });
      await student.save();
      await sendOTPEmail(email, otp);
      console.log("Student registered, OTP sent:", {
        email,
        studentId: student.studentId,
      });
      res.json({ message: "OTP sent to email" });
    } catch (error) {
      console.error("Registration error:", error);
      res
        .status(500)
        .json({
          message: "Registration failed",
          error: (error as Error).message,
        });
    }
  }
);

app.post(
  "/api/auth/verify-otp",
  validate(otpSchema),
  async (req: Request, res: Response) => {
    const { email, otp } = req.body;
    try {
      console.log("OTP verification attempt:", { email, otp });
      const student = await Student.findOne({
        email,
        otp,
        otpExpires: { $gt: new Date() },
      });
      if (!student) {
        console.log("Invalid or expired OTP for:", email);
        return res.status(400).json({ message: "Invalid or expired OTP" });
      }
      student.otp = null;
      student.otpExpires = null;
      await student.save();
      const token = jwt.sign(
        { id: student.studentId, role: "student" },
        process.env.JWT_SECRET || "secret",
        { expiresIn: "1h" }
      );
      console.log("OTP verified, token generated:", {
        studentId: student.studentId,
      });
      res.json({
        token,
        studentId: student.studentId,
        role: "student",
        name: student.name,
      });
    } catch (error) {
      console.error("OTP verification error:", error);
      res
        .status(500)
        .json({
          message: "OTP verification failed",
          error: (error as Error).message,
        });
    }
  }
);

app.post(
  "/api/auth/login",
  validate(loginSchema),
  async (req: Request, res: Response) => {
    const { email, password } = req.body;
    try {
      console.log("Student login attempt:", { email });
      const student = await Student.findOne({ email });
      if (!student) {
        console.log("Student not found:", email);
        return res.status(401).json({ message: "Invalid credentials" });
      }
      const isMatch = await student.comparePassword(password);
      if (!isMatch) {
        console.log("Password mismatch for student:", email);
        return res.status(401).json({ message: "Invalid credentials" });
      }
      const token = jwt.sign(
        { id: student.studentId, role: "student" },
        process.env.JWT_SECRET || "secret",
        { expiresIn: "1h" }
      );
      console.log("Student login successful:", {
        studentId: student.studentId,
      });
      res.json({
        token,
        studentId: student.studentId,
        role: "student",
        name: student.name,
      });
    } catch (error) {
      console.error("Student login error:", error);
      res
        .status(500)
        .json({ message: "Login failed", error: (error as Error).message });
    }
  }
);

app.post(
  "/api/auth/admin/login",
  validate(loginSchema),
  async (req: Request, res: Response) => {
    const { email, password } = req.body;
    try {
      console.log("Admin login attempt:", { email, password: "****" });
      const admin = await Admin.findOne({ email });
      if (!admin) {
        console.log("Admin not found in database:", { email });
        const admins = await Admin.find().select("email").lean();
        console.log(
          "Available admin emails in database:",
          admins.map((a) => a.email)
        );
        return res
          .status(401)
          .json({
            message: "Invalid credentials",
            availableAdmins: admins.map((a) => a.email),
          });
      }
      const isMatch = await admin.comparePassword(password);
      if (!isMatch) {
        console.log("Password mismatch for admin:", { email });
        return res.status(401).json({ message: "Invalid credentials" });
      }
      const token = jwt.sign(
        { id: admin._id.toString(), role: "admin" },
        process.env.JWT_SECRET || "secret",
        { expiresIn: "1h" }
      );
      console.log("Admin login successful:", {
        adminId: admin._id.toString(),
        email,
      });
      res.json({
        token,
        adminId: admin._id.toString(),
        role: "admin",
        email: admin.email,
      });
    } catch (error) {
      console.error("Admin login error:", error);
      res
        .status(500)
        .json({
          message: "Admin login failed",
          error: (error as Error).message,
        });
    }
  }
);

app.post(
  "/api/admin/reset-password",
  validate(resetPasswordSchema),
  async (req: Request, res: Response) => {
    const { email, newPassword, secretKey } = req.body;
    try {
      console.log("Admin password reset attempt:", { email });
      if (secretKey !== process.env.ADMIN_RESET_SECRET) {
        console.log("Invalid secret key for password reset");
        return res.status(403).json({ message: "Invalid secret key" });
      }
      const admin = await Admin.findOne({ email });
      if (!admin) {
        console.log("Admin not found for reset:", email);
        return res.status(404).json({ message: "Admin not found" });
      }
      admin.password = newPassword;
      await admin.save();
      console.log("Admin password reset successful:", { email });
      res.json({ message: "Password reset successful" });
    } catch (error) {
      console.error("Admin password reset error:", error);
      res
        .status(500)
        .json({
          message: "Password reset failed",
          error: (error as Error).message,
        });
    }
  }
);

app.post(
  "/api/admin/question",
  authMiddleware("admin"),
  validate(questionSchema),
  async (req: Request, res: Response) => {
    const { question, code, options, correctAnswer } = req.body;
    try {
      console.log("Creating question:", {
        question,
        optionsCount: options.length,
      });
      if (correctAnswer >= options.length) {
        console.log("Invalid correctAnswer index:", {
          correctAnswer,
          optionsLength: options.length,
        });
        return res
          .status(400)
          .json({ message: "Correct answer index out of range" });
      }
      const questionId = uuidv4();
      const newQuestion = new Question({
        questionId,
        question,
        code: code || "",
        options,
        correctAnswer,
      });
      await newQuestion.save();
      console.log("Question created:", { questionId, question });
      res.json({ success: true, questionId });
    } catch (error) {
      console.error("Question creation error:", error);
      res
        .status(400)
        .json({
          message: "Question creation failed",
          error: (error as Error).message,
        });
    }
  }
);

app.get(
  "/api/admin/questions",
  authMiddleware("admin"),
  async (req: Request, res: Response) => {
    try {
      console.log("Fetching all questions for admin");
      const questions = await Question.find().lean();
      console.log(
        "Questions found:",
        questions.map((q) => ({
          questionId: q.questionId,
          question: q.question,
        }))
      );
      res.json(questions);
    } catch (error) {
      console.error("Error fetching questions:", error);
      res
        .status(500)
        .json({
          message: "Failed to fetch questions",
          error: (error as Error).message,
        });
    }
  }
);

app.get(
  "/api/admin/students",
  authMiddleware("admin"),
  async (req: Request, res: Response) => {
    try {
      console.log("Fetching all students for admin");
      const students = await Student.find()
        .select("studentId name email profile")
        .lean();
      console.log(
        "Students found:",
        students.map((s) => ({
          studentId: s.studentId,
          name: s.name,
          email: s.email,
        }))
      );
      res.json(students);
    } catch (error) {
      console.error("Error fetching students:", error);
      res
        .status(500)
        .json({
          message: "Failed to fetch students",
          error: (error as Error).message,
        });
    }
  }
);

app.post(
  "/api/admin/test",
  authMiddleware("admin"),
  validate(testSchema),
  async (req: Request, res: Response) => {
    const { name, date, duration, questionIds } = req.body;
    try {
      console.log("Creating test:", { name, date, duration, questionIds });
      const testDate = new Date(date);
      if (isNaN(testDate.getTime())) {
        console.log("Invalid date format:", date);
        return res
          .status(400)
          .json({
            message:
              "Invalid date format. Use ISO format (e.g., 2025-07-11T10:20:00.000Z)",
          });
      }
      const now = new Date();
      const bufferTime = new Date(testDate.getTime() - 5 * 60 * 1000);
      if (now >= bufferTime) {
        console.log("Test creation too close to start time:", {
          provided: testDate.toISOString(),
          now: now.toISOString(),
          minAllowed: bufferTime.toISOString(),
        });
        return res
          .status(400)
          .json({
            message:
              "Test cannot be created within 5 minutes of its start time",
          });
      }
      const questions = await Question.find({
        questionId: { $in: questionIds },
      });
      if (questions.length !== questionIds.length) {
        console.log("Invalid question IDs:", {
          provided: questionIds,
          found: questions.map((q) => q.questionId),
        });
        return res
          .status(400)
          .json({ message: "One or more question IDs are invalid" });
      }
      const testId = uuidv4();
      const test = new Test({
        testId,
        name,
        date: testDate,
        duration,
        questionIds: questions.map((q) => q._id),
      });
      await test.save();
      console.log("Test saved to database:", {
        testId,
        name,
        date: testDate.toISOString(),
      });
      const students = await Student.find();
      await Promise.all(
        students.map((student) =>
          sendTestNotification(student.email, name, testDate, duration)
        )
      );
      console.log("Test created, notifications sent:", {
        testId,
        date: testDate.toISOString(),
      });
      res.json({ success: true, testId });
    } catch (error) {
      console.error("Test creation error:", error);
      res
        .status(400)
        .json({
          message: "Test creation failed",
          error: (error as Error).message,
        });
    }
  }
);

app.post("/api/debug/create-test", async (req: Request, res: Response) => {
  const { name, date, duration, questionIds } = req.body;
  try {
    const { error } = testSchema.validate(req.body);
    if (error) {
      console.log(
        "Validation error for debug test creation:",
        error.details[0].message
      );
      return res.status(400).json({ message: error.details[0].message });
    }
    const testDate = new Date(date);
    if (isNaN(testDate.getTime())) {
      console.log("Invalid date format in debug test creation:", date);
      return res.status(400).json({ message: "Invalid date format" });
    }
    const questions = await Question.find({ questionId: { $in: questionIds } });
    if (questions.length !== questionIds.length) {
      console.log("Invalid question IDs in debug test creation:", {
        provided: questionIds,
        found: questions.map((q) => q.questionId),
      });
      return res
        .status(400)
        .json({ message: "One or more question IDs are invalid" });
    }
    const testId = uuidv4();
    const test = new Test({
      testId,
      name,
      date: testDate,
      duration,
      questionIds: questions.map((q) => q._id),
    });
    await test.save();
    console.log("Debug test created:", {
      testId,
      name,
      date: testDate.toISOString(),
    });
    res.json({ success: true, testId });
  } catch (error) {
    console.error("Debug test creation error:", error);
    res
      .status(400)
      .json({
        message: "Debug test creation failed",
        error: (error as Error).message,
      });
  }
});

app.get("/api/tests", async (req: Request, res: Response) => {
  try {
    console.log("Fetching all tests");
    const tests = await Test.find().populate("questionIds").lean();
    console.log(
      "Tests found:",
      tests.map((t) => ({
        testId: t.testId,
        name: t.name,
        date: t.date.toISOString(),
      }))
    );
    res.json(tests);
  } catch (error) {
    console.error("Error fetching tests:", error);
    res
      .status(500)
      .json({
        message: "Failed to fetch tests",
        error: (error as Error).message,
      });
  }
});

app.get(
  "/api/student/test/:testId",
  authMiddleware("student"),
  async (req: AuthRequest, res: Response) => {
    try {
      const testId = req.params.testId.trim();
      console.log("Fetching test with testId:", testId);
      console.log("User from token:", {
        userId: req.user!.id,
        role: req.user!.role,
      });

      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(testId)) {
        console.log("Invalid testId format:", testId);
        return res
          .status(400)
          .json({ message: "Invalid test ID format", requestedTestId: testId });
      }

      const test = await Test.findOne({ testId })
        .populate("questionIds")
        .lean();
      if (!test) {
        const allTests = await Test.find().select("testId name date").lean();
        console.log(
          "All test IDs in database:",
          allTests.map((t) => ({
            testId: t.testId,
            name: t.name,
            date: t.date,
          }))
        );
        console.log("Test not found in database:", testId);
        return res.status(404).json({
          message: "Test not found",
          requestedTestId: testId,
          availableTestIds: allTests.map((t) => t.testId),
        });
      }

      const existingResult = await Result.findOne({
        testId,
        studentId: req.user!.id,
      });
      if (existingResult) {
        console.log("Test already taken:", {
          testId,
          studentId: req.user!.id,
          resultId: existingResult._id,
        });
        return res.status(400).json({ message: "Test already taken", testId });
      }

      const now = new Date();
      const testStart = new Date(test.date);
      const testEnd = new Date(testStart.getTime() + test.duration * 60 * 1000);
      console.log("Test timing check:", {
        testId,
        now: now.toISOString(),
        testStart: testStart.toISOString(),
        testEnd: testEnd.toISOString(),
      });
      if (now < testStart || now > testEnd) {
        console.log("Test not active:", {
          testId,
          now: now.toISOString(),
          testStart: testStart.toISOString(),
          testEnd: testEnd.toISOString(),
        });
        return res.status(400).json({
          message: "Test is not currently active",
          testId,
          startTime: testStart.toISOString(),
          endTime: testEnd.toISOString(),
        });
      }

      console.log("Test found and active:", {
        testId: test.testId,
        name: test.name,
        date: test.date.toISOString(),
        duration: test.duration,
        questionsCount: test.questionIds.length,
      });

      const sanitizedQuestions = test.questionIds.map((q: any) => ({
        questionId: q.questionId,
        question: q.question,
        code: q.code,
        options: q.options,
      }));
      res.json({
        testId: test.testId,
        name: test.name,
        duration: test.duration,
        date: test.date.toISOString(),
        questions: sanitizedQuestions,
      });
    } catch (error) {
      console.error("Error fetching test:", error);
      res
        .status(500)
        .json({
          message: "Failed to fetch test",
          error: (error as Error).message,
        });
    }
  }
);

app.post(
  "/api/student/submit",
  authMiddleware("student"),
  validate(submitSchema),
  async (req: AuthRequest, res: Response) => {
    const { testId, answers } = req.body;
    const studentId = req.user!.id;
    try {
      console.log("Test submission:", { testId, studentId });
      const test = await Test.findOne({ testId }).populate("questionIds");
      if (!test) {
        console.log("Test not found:", testId);
        return res.status(404).json({ message: "Test not found" });
      }
      const now = new Date();
      const testEnd = new Date(test.date.getTime() + test.duration * 60 * 1000);
      if (now > testEnd) {
        console.log("Test duration expired:", {
          testId,
          now: now.toISOString(),
          testEnd: testEnd.toISOString(),
        });
        return res.status(400).json({ message: "Test duration expired" });
      }
      let score = 0;
      test.questionIds.forEach((q: any, i: number) => {
        if (q.correctAnswer === answers[i]) score++;
      });
      const result = new Result({
        testId,
        studentId,
        answers,
        score,
        totalQuestions: test.questionIds.length,
      });
      await result.save();
      const student = await Student.findOne({ studentId });
      await sendResultNotification(
        student!.email,
        test.name,
        score,
        test.questionIds.length
      );
      console.log("Test submitted, result saved:", {
        testId,
        studentId,
        score,
      });
      res.json({
        success: true,
        score,
        totalQuestions: test.questionIds.length,
      });
    } catch (error) {
      console.error("Test submission error:", error);
      res
        .status(400)
        .json({
          message: "Submission failed",
          error: (error as Error).message,
        });
    }
  }
);

app.get(
  "/api/student/results/:studentId",
  authMiddleware("student"),
  async (req: AuthRequest, res: Response) => {
    if (req.user!.id !== req.params.studentId) {
      console.log("Access denied: Student ID mismatch", {
        userId: req.user!.id,
        requestedId: req.params.studentId,
      });
      return res.status(403).json({ message: "Access denied" });
    }
    try {
      console.log("Fetching results for student:", req.params.studentId);
      const results = await Result.find({
        studentId: req.params.studentId,
      }).populate({
        path: "testId",
        select: "testId name date",
      });
      res.json(results);
    } catch (error) {
      console.error("Error fetching student results:", error);
      res
        .status(500)
        .json({
          message: "Failed to fetch results",
          error: (error as Error).message,
        });
    }
  }
);

app.get(
  "/api/student/profile/:studentId",
  authMiddleware("student"),
  async (req: AuthRequest, res: Response) => {
    if (req.user!.id !== req.params.studentId) {
      console.log("Access denied: Student ID mismatch", {
        userId: req.user!.id,
        requestedId: req.params.studentId,
      });
      return res.status(403).json({ message: "Access denied" });
    }
    try {
      console.log("Fetching profile for student:", req.params.studentId);
      const student = await Student.findOne({
        studentId: req.params.studentId,
      }).select("studentId name email profile");
      if (!student) {
        console.log("Student not found:", req.params.studentId);
        return res.status(404).json({ message: "Student not found" });
      }
      res.json(student);
    } catch (error) {
      console.error("Error fetching student profile:", error);
      res
        .status(500)
        .json({
          message: "Failed to fetch profile",
          error: (error as Error).message,
        });
    }
  }
);

app.put(
  "/api/student/profile/:studentId",
  authMiddleware("student"),
  validate(profileSchema),
  async (req: AuthRequest, res: Response) => {
    if (req.user!.id !== req.params.studentId) {
      console.log("Access denied: Student ID mismatch", {
        userId: req.user!.id,
        requestedId: req.params.studentId,
      });
      return res.status(403).json({ message: "Access denied" });
    }
    const { name, dob, phone, address } = req.body;
    try {
      console.log("Updating profile for student:", req.params.studentId);
      await Student.updateOne(
        { studentId: req.params.studentId },
        { name, profile: { dob, phone, address } }
      );
      res.json({ success: true });
    } catch (error) {
      console.error("Profile update error:", error);
      res
        .status(400)
        .json({
          message: "Profile update failed",
          error: (error as Error).message,
        });
    }
  }
);

app.get(
  "/api/admin/results",
  authMiddleware("admin"),
  async (req: Request, res: Response) => {
    try {
      console.log("Fetching all results for admin");
      const results = await Result.find()
        .populate({
          path: "testId",
          select: "testId name date",
        })
        .populate({
          path: "studentId",
          select: "studentId name email",
        });
      res.json(results);
    } catch (error) {
      console.error("Error fetching admin results:", error);
      res
        .status(500)
        .json({
          message: "Failed to fetch results",
          error: (error as Error).message,
        });
    }
  }
);

app.get(
  "/api/student/rank/:studentId",
  authMiddleware("student"),
  async (req: AuthRequest, res: Response) => {
    if (req.user!.id !== req.params.studentId) {
      console.log("Access denied: Student ID mismatch", {
        userId: req.user!.id,
        requestedId: req.params.studentId,
      });
      return res.status(403).json({ message: "Access denied" });
    }
    try {
      console.log("Fetching rank for student:", req.params.studentId);
      const allResults = await Result.find().lean();

      if (!allResults.length) {
        console.log("No results found in database");
        return res
          .status(404)
          .json({ message: "No results available to calculate rank" });
      }

      const studentScores: {
        [key: string]: { totalScore: number; totalQuestions: number };
      } = {};
      allResults.forEach((result) => {
        if (!studentScores[result.studentId]) {
          studentScores[result.studentId] = {
            totalScore: 0,
            totalQuestions: 0,
          };
        }
        studentScores[result.studentId].totalScore += result.score;
        studentScores[result.studentId].totalQuestions += result.totalQuestions;
      });

      const studentAverages = Object.keys(studentScores)
        .map((studentId) => ({
          studentId,
          averagePercentage:
            studentScores[studentId].totalQuestions > 0
              ? (studentScores[studentId].totalScore /
                  studentScores[studentId].totalQuestions) *
                100
              : 0,
        }))
        .filter((s) => s.averagePercentage > 0); // Exclude students with no valid scores

      if (!studentAverages.some((s) => s.studentId === req.params.studentId)) {
        console.log(
          "No valid results found for student:",
          req.params.studentId
        );
        return res
          .status(404)
          .json({ message: "No valid results found for student" });
      }

      studentAverages.sort((a, b) => b.averagePercentage - a.averagePercentage);

      const rank =
        studentAverages.findIndex((s) => s.studentId === req.params.studentId) +
        1;

      console.log("Rank calculated:", {
        studentId: req.params.studentId,
        rank,
      });
      res.json({ rank });
    } catch (error) {
      console.error("Error fetching student rank:", error);
      res
        .status(500)
        .json({
          message: "Failed to fetch rank",
          error: (error as Error).message,
        });
    }
  }
);

app.get("/api/debug/tests", async (req: Request, res: Response) => {
  try {
    console.log("Fetching all tests for debugging");
    const tests = await Test.find().select("testId name date").lean();
    console.log(
      "All tests:",
      tests.map((t) => ({
        testId: t.testId,
        name: t.name,
        date: t.date.toISOString(),
      }))
    );
    res.json(tests);
  } catch (error) {
    console.error("Error fetching debug tests:", error);
    res
      .status(500)
      .json({
        message: "Failed to fetch tests",
        error: (error as Error).message,
      });
  }
});

app.use(errorHandler);

app.listen(process.env.PORT || 5000, () =>
  console.log(`Server running on port ${process.env.PORT || 5000}`)
);
