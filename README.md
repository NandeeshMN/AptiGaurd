### AptiGuard
---

AptiGuard is a secure **college aptitude assessment and online proctoring platform** designed to provide a controlled and distraction-free environment for conducting online aptitude tests.

The platform aims to replace traditional Google Form-based aptitude tests with a dedicated assessment system that enables colleges to create, schedule, conduct, monitor, and evaluate aptitude assessments.

### Features
---

- Secure student registration and login
- Firebase Authentication
- Firebase Firestore database
- Student dashboard
- Admin dashboard
- Aptitude test management
- Question management
- Test scheduling and assignment
- Online aptitude assessments
- Fullscreen test environment
- Violation detection
- Warning system for test violations
- Automatic test submission after repeated violations
- Automatic test evaluation
- Student results and performance analytics
- Live monitoring using admin dashboard 

### Tech Stack
---

**Frontend**

- React
- TypeScript
- Vite
- React Router
- Firebase JavaScript SDK

**Backend**

- Node.js
- Express.js
- TypeScript
- Firebase Admin SDK

**Database**

- Firebase Firestore

**Authentication**

- Firebase Authentication
- Email/Password Authentication

### Project Structure
---


### Authentication
---

AptiGuard uses Firebase Authentication for secure student registration and login.

**Registration Flow**

```text
Full Name + Email + Password
            ↓
Firebase Authentication
            ↓
Create User Profile in Firestore
            ↓
Registration Successful
            ↓
Login
```

**Login Flow**

```text
Email + Password
       ↓
Firebase Authentication
       ↓
Successful Login
       ↓
Student Dashboard
```

Passwords are managed by Firebase Authentication and are **never stored in Firestore**.


### Student Dashboard
---

The Student Dashboard is the main interface students see after successful authentication.

Students will be able to:

- View available aptitude tests
- View upcoming tests
- View completed tests
- Start assigned tests
- Read test instructions
- View test duration and question count
- View recent test activity
- Track test performance
- View results
- Access profile and account settings

The dashboard is designed specifically around the aptitude assessment workflow rather than generic LMS functionality.

### Admin Dashboard
---

The Admin Dashboard provides administrators with an overview of the AptiGuard assessment system.

Administrators will be able to:

- View total students
- View available and active tests
- Monitor test activity
- Create aptitude tests
- Manage questions
- Schedule assessments
- Assign tests to students
- Monitor test attempts
- View student results
- Analyze assessment performance

### Aptitude Test
---

AptiGuard will allow students to take structured online aptitude assessments.

Students will be able to:

- View assigned tests
- Read test instructions
- Start tests
- Answer questions
- Navigate between questions
- Track remaining time
- Save answers
- Submit tests

A test may contain:

- Test title
- Description
- Questions
- Options
- Duration
- Marks
- Passing score
- Scheduled date and time
- Assigned students

### Online Proctoring
---

AptiGuard will provide a controlled testing environment to reduce common forms of cheating during online aptitude assessments.

Potential violation signals include:

- Exiting fullscreen mode
- Switching browser tabs
- Losing browser focus
- Copy/paste attempts
- Right-click attempts
- Certain keyboard shortcuts

These signals will be treated as **violation indicators** rather than guaranteeing that cheating is impossible.



### Project Goal
---

AptiGuard aims to provide colleges with a reliable and secure alternative to traditional Google Form-based aptitude tests by combining:

**Assessment Management + Secure Testing + Online Proctoring + Automated Evaluation + Performance Analytics**
