import express, { Request, Response, NextFunction } from 'express';
import mongoose, { Types } from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Joi from 'joi';
import { v4 as uuidv4 } from 'uuid';
import rateLimit from 'express-rate-limit';

dotenv.config();

const app = express();

// Middleware
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000' }));
app.use(express.json());

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests
});
app.use(limiter);

// MongoDB Connection
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || '', { dbName: 'testSystem' });
    console.log('MongoDB connected');

    // Create admin account if it doesn't exist
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (adminEmail && adminPassword) {
      const existingAdmin = await Admin.findOne({ email: adminEmail });
      if (!existingAdmin) {
        const hashedPassword = await bcrypt.hash(adminPassword, 10);
        const admin = new Admin({
          email: adminEmail,
          password: hashedPassword,
        });
        await admin.save();
        console.log(`Admin account created for email: ${adminEmail}, hashed password: ${hashedPassword}`);
      } else {
        console.log(`Admin account already exists for email: ${adminEmail}`);
        const isMatch = await bcrypt.compare(adminPassword, existingAdmin.password);
        if (!isMatch) {
          console.warn(`Password mismatch for admin ${adminEmail}. Updating password.`);
          const hashedPassword = await bcrypt.hash(adminPassword, 10);
          await Admin.updateOne({ email: adminEmail }, { password: hashedPassword });
          console.log(`Admin password updated for ${adminEmail}`);
        } else {
          console.log(`Admin password verified for ${adminEmail}`);
        }
      }
    } else {
      console.warn('ADMIN_EMAIL or ADMIN_PASSWORD not set in .env');
    }
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};
connectDB();

// Nodemailer Setup
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
});

const sendOTPEmail = async (to: string, otp: string) => {
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to,
      subject: 'Your OTP for Registration',
      html: `<div style="font-family: Arial, sans-serif; padding: 20px;"><h2>OTP Verification</h2><p>Your OTP is <strong>${otp}</strong>. It is valid for 10 minutes.</p></div>`,
    });
    console.log(`OTP email sent to ${to}`);
  } catch (error) {
    console.error(`Failed to send OTP email to ${to}:`, error);
    throw new Error('Failed to send OTP email');
  }
};

const sendTestNotification = async (to: string, testName: string, date: Date, duration: number) => {
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to,
      subject: `New Test: ${testName}`,
      html: `<div style="font-family: Arial, sans-serif; padding: 20px;"><h2>New Test Scheduled</h2><p>A new test "${testName}" is scheduled for ${date.toLocaleString()}. Duration: ${duration} minutes.</p></div>`,
    });
    console.log(`Test notification sent to ${to}`);
  } catch (error) {
    console.error(`Failed to send test notification to ${to}:`, error);
    throw new Error('Failed to send test notification');
  }
};

const sendResultNotification = async (to: string, testName: string, score: number, total: number) => {
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
    throw new Error('Failed to send result notification');
  }
};

// Mongoose Models
interface IAdmin extends mongoose.Document {
  _id: Types.ObjectId; // Fix: Explicitly type _id as ObjectId
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
  questions: mongoose.Types.ObjectId[];
}

interface IResult extends mongoose.Document {
  testId: string;
  studentId: string;
  answers: number[];
  score: number;
  totalQuestions: number;
}

const AdminSchema = new mongoose.Schema({
  _id: { type: mongoose.Schema.Types.ObjectId, auto: true }, // Fix: Explicitly define _id
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
});

AdminSchema.pre('save', async function (next) {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});

AdminSchema.methods.comparePassword = async function (password: string) {
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

StudentSchema.pre('save', async function (next) {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});

StudentSchema.methods.comparePassword = async function (password: string) {
  return bcrypt.compare(password, this.password);
};

const QuestionSchema = new mongoose.Schema({
  questionId: { type: String, required: true, unique: true },
  question: { type: String, required: true },
  code: { type: String },
  options: [{ type: String, required: true }],
  correctAnswer: { type: Number, required: true },
});

const TestSchema = new mongoose.Schema({
  testId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  date: { type: Date, required: true },
  duration: { type: Number, required: true },
  questions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Question' }],
});

const ResultSchema = new mongoose.Schema({
  testId: { type: String, required: true },
  studentId: { type: String, required: true },
  answers: [Number],
  score: Number,
  totalQuestions: Number,
});

const Admin = mongoose.model<IAdmin>('Admin', AdminSchema);
const Student = mongoose.model<IStudent>('Student', StudentSchema);
const Question = mongoose.model<IQuestion>('Question', QuestionSchema);
const Test = mongoose.model<ITest>('Test', TestSchema);
const Result = mongoose.model<IResult>('Result', ResultSchema);

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

const questionSchema = Joi.object({
  question: Joi.string().required(),
  code: Joi.string().allow('').optional(),
  options: Joi.array().items(Joi.string()).min(2).required(),
  correctAnswer: Joi.number().min(0).required(),
});

const testSchema = Joi.object({
  name: Joi.string().min(3).required(),
  date: Joi.date().required(),
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

const authMiddleware = (role: 'admin' | 'student') => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      console.log('No token provided in request');
      return res.status(401).json({ message: 'No token provided' });
    }
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as { id: string; role: string };
      console.log('Decoded token:', { id: decoded.id, role: decoded.role });
      if (decoded.role !== role) {
        console.log(`Access denied: Expected role ${role}, got ${decoded.role}`);
        return res.status(403).json({ message: 'Access denied' });
      }
      req.user = decoded;
      next();
    } catch (error) {
      console.error('Token verification error:', error);
      res.status(401).json({ message: 'Invalid token' });
    }
  };
};

const validate = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error } = schema.validate(req.body);
    if (error) {
      console.log('Validation error:', error.details[0].message);
      return res.status(400).json({ message: error.details[0].message });
    }
    next();
  };
};

const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Server error:', err.stack);
  res.status(500).json({ message: 'Internal server error' });
};

// Routes
// Register
app.post('/api/auth/register', validate(registerSchema), async (req: Request, res: Response) => {
  const { name, email, password, dob, phone, address } = req.body;
  try {
    console.log('Register attempt:', { email });
    let student = await Student.findOne({ email });
    if (student) {
      console.log('Email already exists:', email);
      return res.status(400).json({ message: 'Email already exists' });
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
    console.log('Student registered, OTP sent:', { email, studentId: student.studentId });
    res.json({ message: 'OTP sent to email' });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Registration failed' });
  }
});

// Verify OTP
app.post('/api/auth/verify-otp', validate(otpSchema), async (req: Request, res: Response) => {
  const { email, otp } = req.body;
  try {
    console.log('OTP verification attempt:', { email, otp });
    const student = await Student.findOne({ email, otp, otpExpires: { $gt: new Date() } });
    if (!student) {
      console.log('Invalid or expired OTP for:', email);
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    student.otp = null;
    student.otpExpires = null;
    await student.save();

    const token = jwt.sign({ id: student.studentId, role: 'student' }, process.env.JWT_SECRET || 'secret', { expiresIn: '1h' });
    console.log('OTP verified, token generated:', { studentId: student.studentId, token });
    res.json({ token, studentId: student.studentId, role: 'student' });
  } catch (error) {
    console.error('OTP verification error:', error);
    res.status(500).json({ message: 'OTP verification failed' });
  }
});

// Login
app.post('/api/auth/login', validate(loginSchema), async (req: Request, res: Response) => {
  const { email, password } = req.body;
  try {
    console.log('Student login attempt:', { email });
    const student = await Student.findOne({ email });
    if (!student) {
      console.log('Student not found:', email);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isMatch = await student.comparePassword(password);
    if (!isMatch) {
      console.log('Password mismatch for student:', email);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: student.studentId, role: 'student' }, process.env.JWT_SECRET || 'secret', { expiresIn: '1h' });
    console.log('Student login successful:', { studentId: student.studentId, token });
    res.json({ token, studentId: student.studentId, role: 'student' });
  } catch (error) {
    console.error('Student login error:', error);
    res.status(500).json({ message: 'Login failed' });
  }
});

// Admin Login
app.post('/api/auth/admin/login', validate(loginSchema), async (req: Request, res: Response) => {
  const { email, password } = req.body;
  try {
    console.log('Admin login attempt:', { email });
    const admin = await Admin.findOne({ email });
    if (!admin) {
      console.log('Admin not found:', email);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isMatch = await admin.comparePassword(password);
    if (!isMatch) {
      console.log('Password mismatch for admin:', email);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: admin._id.toString(), role: 'admin' }, process.env.JWT_SECRET || 'secret', { expiresIn: '1h' });
    console.log('Admin login successful:', { adminId: admin._id.toString(), token });
    res.json({ token, adminId: admin._id.toString(), role: 'admin' });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ message: 'Admin login failed' });
  }
});

// Create Question
app.post('/api/admin/question', authMiddleware('admin'), validate(questionSchema), async (req: Request, res: Response) => {
  const { question, code, options, correctAnswer } = req.body;
  try {
    console.log('Creating question:', { question, code });
    const newQuestion = new Question({
      questionId: uuidv4(),
      question,
      code,
      options,
      correctAnswer,
    });
    await newQuestion.save();
    console.log('Question created:', { questionId: newQuestion.questionId });
    res.json({ success: true, questionId: newQuestion.questionId });
  } catch (error) {
    console.error('Question creation error:', error);
    res.status(400).json({ message: 'Question creation failed' });
  }
});

// Get All Questions
app.get('/api/admin/questions', authMiddleware('admin'), async (req: Request, res: Response) => {
  try {
    console.log('Fetching all questions');
    const questions = await Question.find();
    res.json(questions);
  } catch (error) {
    console.error('Error fetching questions:', error);
    res.status(500).json({ message: 'Failed to fetch questions' });
  }
});

// Create Test
app.post('/api/admin/test', authMiddleware('admin'), validate(testSchema), async (req: Request, res: Response) => {
  const { name, date, duration, questionIds } = req.body;
  try {
    console.log('Creating test:', { name, date, duration, questionIds });
    const questions = await Question.find({ questionId: { $in: questionIds } });
    if (questions.length !== questionIds.length) {
      return res.status(400).json({ message: 'Some questions not found' });
    }
    const test = new Test({
      testId: uuidv4(),
      name,
      date,
      duration,
      questions: questions.map((q) => q._id),
    });
    await test.save();
    const students = await Student.find();
    await Promise.all(students.map((student) => sendTestNotification(student.email, name, new Date(date), duration)));
    console.log('Test created, notifications sent:', { testId: test.testId });
    res.json({ success: true, testId: test.testId });
  } catch (error) {
    console.error('Test creation error:', error);
    res.status(400).json({ message: 'Test creation failed' });
  }
});

// Get All Tests
app.get('/api/tests', async (req: Request, res: Response) => {
  try {
    console.log('Fetching all tests');
    const tests = await Test.find().populate('questions');
    res.json(tests);
  } catch (error) {
    console.error('Error fetching tests:', error);
    res.status(500).json({ message: 'Failed to fetch tests' });
  }
});

// Get Test for Student
app.get('/api/student/test/:testId', authMiddleware('student'), async (req: AuthRequest, res: Response) => {
  try {
    const test = await Test.findOne({ testId: req.params.testId }).populate('questions');
    if (!test) {
      console.log('Test not found:', req.params.testId);
      return res.status(404).json({ message: 'Test not found' });
    }
    res.json({ testId: test.testId, name: test.name, duration: test.duration, questions: test.questions });
  } catch (error) {
    console.error('Error fetching test:', error);
    res.status(500).json({ message: 'Failed to fetch test' });
  }
});

// Submit Test
app.post('/api/student/submit', authMiddleware('student'), validate(submitSchema), async (req: AuthRequest, res: Response) => {
  const { testId, answers } = req.body;
  const studentId = req.user!.id;
  try {
    console.log('Test submission:', { testId, studentId });
    const test = await Test.findOne({ testId }).populate('questions');
    if (!test) {
      console.log('Test not found:', testId);
      return res.status(404).json({ message: 'Test not found' });
    }
    const now = new Date();
    const testEnd = new Date(test.date.getTime() + test.duration * 60 * 1000);
    if (now > testEnd) {
      console.log('Test duration expired:', { testId, now, testEnd });
      return res.status(400).json({ message: 'Test duration expired' });
    }
    let score = 0;
    test.questions.forEach((q: any, i: number) => {
      if (q.correctAnswer === answers[i]) score++;
    });
    const result = new Result({
      testId,
      studentId,
      answers,
      score,
      totalQuestions: test.questions.length,
    });
    await result.save();
    const student = await Student.findOne({ studentId });
    await sendResultNotification(student!.email, test.name, score, test.questions.length);
    console.log('Test submitted, result saved:', { testId, studentId, score });
    res.json({ success: true, score, totalQuestions: test.questions.length });
  } catch (error) {
    console.error('Test submission error:', error);
    res.status(400).json({ message: 'Submission failed' });
  }
});

// Get Student Results
app.get('/api/student/results/:studentId', authMiddleware('student'), async (req: AuthRequest, res: Response) => {
  if (req.user!.id !== req.params.studentId) {
    console.log('Access denied: Student ID mismatch', { userId: req.user!.id, requestedId: req.params.studentId });
    return res.status(403).json({ message: 'Access denied' });
  }
  try {
    console.log('Fetching results for student:', req.params.studentId);
    const results = await Result.find({ studentId: req.params.studentId }).populate('testId');
    res.json(results);
  } catch (error) {
    console.error('Error fetching student results:', error);
    res.status(500).json({ message: 'Failed to fetch results' });
  }
});

// Get Student Profile
app.get('/api/student/profile/:studentId', authMiddleware('student'), async (req: AuthRequest, res: Response) => {
  if (req.user!.id !== req.params.studentId) {
    console.log('Access denied: Student ID mismatch', { userId: req.user!.id, requestedId: req.params.studentId });
    return res.status(403).json({ message: 'Access denied' });
  }
  try {
    console.log('Fetching profile for student:', req.params.studentId);
    const student = await Student.findOne({ studentId: req.params.studentId });
    res.json(student);
  } catch (error) {
    console.error('Error fetching student profile:', error);
    res.status(500).json({ message: 'Failed to fetch profile' });
  }
});

// Update Student Profile
app.put('/api/student/profile/:studentId', authMiddleware('student'), validate(profileSchema), async (req: AuthRequest, res: Response) => {
  if (req.user!.id !== req.params.studentId) {
    console.log('Access denied: Student ID mismatch', { userId: req.user!.id, requestedId: req.params.studentId });
    return res.status(403).json({ message: 'Access denied' });
  }
  const { name, dob, phone, address } = req.body;
  try {
    console.log('Updating profile for student:', req.params.studentId);
    await Student.updateOne({ studentId: req.params.studentId }, { name, profile: { dob, phone, address } });
    res.json({ success: true });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(400).json({ message: 'Profile update failed' });
  }
});

// Get All Results for Admin
app.get('/api/admin/results', authMiddleware('admin'), async (req: Request, res: Response) => {
  try {
    console.log('Fetching all results for admin');
    const results = await Result.find().populate('testId').populate('studentId');
    res.json(results);
  } catch (error) {
    console.error('Error fetching admin results:', error);
    res.status(500).json({ message: 'Failed to fetch results' });
  }
});

// Error Handler
app.use(errorHandler);

app.listen(process.env.PORT || 5000, () => console.log(`Server running on port ${process.env.PORT || 5000}`));