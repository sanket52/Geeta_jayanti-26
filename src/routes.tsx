import { createBrowserRouter } from "react-router";
import PublicLayout from "./layouts/PublicLayout";
import StudentLayout from "./layouts/StudentLayout";
import AdminLayout from "./layouts/AdminLayout";
import ExamLayout from "./layouts/ExamLayout";
import Home from "./pages/Home";
import About from "./pages/About";
import Activities from "./pages/Activities";
import Competitions from "./pages/Competitions";
import Contact from "./pages/Contact";
import Exam from "./pages/Exam";
import Privacy from "./pages/Privacy";
import StudentLogin from "./pages/StudentLogin";
import AdminLogin from "./pages/AdminLogin";
import StudentRegister from "./pages/StudentRegister";
import NotFound from "./pages/NotFound";
import StudentDashboard from "./pages/student/Dashboard";
import StudentCompetitions from "./pages/student/Competitions";
import StudentProfile from "./pages/student/Profile";
import StudentDocuments from "./pages/student/Documents";
import StudentExamination from "./pages/student/Examination";
import StudentResults from "./pages/student/Results";
import StudentOralExam from "./pages/student/OralExam";
import AdmitCard from "./pages/student/AdmitCard";
import Certificate from "./pages/student/Certificate";
import VerifyDocument from "./pages/VerifyDocument";
import AdminDashboard from "./pages/admin/Dashboard";
import AdminStudents from "./pages/admin/Students";
import AdminStatistics from "./pages/admin/Statistics";
import AdminCompetitions from "./pages/admin/Competitions";
import GjmJudging from "./pages/admin/GjmJudging";
import ExamOrganizer from "./pages/admin/ExamOrganizer";
import AdminNotices from "./pages/admin/Notices";
import AdminQuestions from "./pages/admin/Questions";
import AdminResults from "./pages/admin/Results";
import AdminStaff from "./pages/admin/Staff";
import AdminChatbotFaqs from "./pages/admin/ChatbotFaqs";
import AdminContactSettings from "./pages/admin/ContactSettings";
import AdminMockQuestions from "./pages/admin/MockQuestions";
import AdminHomeCarousel from "./pages/admin/HomeCarousel";
import ExamPortal from "./pages/exam/ExamPortal";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: PublicLayout,
    children: [
      { index: true, Component: Home },
      { path: "about", Component: About },
      { path: "about-gurukul", Component: About },
      { path: "activities", Component: Activities },
      { path: "competitions", Component: Competitions },
      { path: "exam", Component: Exam },
      { path: "contact", Component: Contact },
      { path: "privacy", Component: Privacy },
      { path: "login", Component: StudentLogin },
      { path: "register", Component: StudentRegister },
      { path: "admin/login", Component: AdminLogin },
      { path: "verify", Component: VerifyDocument },
    ],
  },
  {
    path: "/student",
    Component: StudentLayout,
    children: [
      { index: true, Component: StudentDashboard },
      { path: "competitions", Component: StudentCompetitions },
      { path: "profile", Component: StudentProfile },
      { path: "documents", Component: StudentDocuments },
      { path: "exam", Component: StudentExamination },
      { path: "oral-exam", Component: StudentOralExam },
      { path: "results", Component: StudentResults },
      { path: "admit-card", Component: AdmitCard },
      { path: "certificate", Component: Certificate },
    ],
  },
  {
    path: "/admin",
    Component: AdminLayout,
    children: [
      { index: true, Component: AdminDashboard },
      { path: "students", Component: AdminStudents },
      { path: "statistics", Component: AdminStatistics },
      { path: "competitions", Component: AdminCompetitions },
      { path: "mahotsav-judging", Component: GjmJudging },
      { path: "exam-organizer", Component: ExamOrganizer },
      { path: "questions", Component: AdminQuestions },
      { path: "results", Component: AdminResults },
      { path: "staff", Component: AdminStaff },
      { path: "notices", Component: AdminNotices },
      { path: "chatbot-faqs", Component: AdminChatbotFaqs },
      { path: "contact-settings", Component: AdminContactSettings },
      { path: "mock-questions", Component: AdminMockQuestions },
      { path: "home-carousel", Component: AdminHomeCarousel },
    ],
  },
  {
    path: "/competition/exam",
    Component: ExamLayout,
    children: [{ index: true, Component: ExamPortal }],
  },
  { path: "*", Component: NotFound },
]);
