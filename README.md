
# ExamGuard - Secure Online Proctoring Portal

ExamGuard is a secure online examination system built with Next.js, Firebase, and Genkit AI. It aims to ensure academic integrity through real-time monitoring and AI-based proctoring. The system allows administrators to create and schedule exams, whitelist users, and monitor test-takers for suspicious activities.

## Features

### Admin Features
- **Secure Admin Authentication:** Separate login and registration for administrators.
- **User Whitelisting:** Admins can whitelist users via email, allowing them to take scheduled exams associated with that admin.
- **Exam Scheduling:** Create and manage exam schedules, set time limits, and define exam names.
- **Activity Monitoring:**
    - View a real-time aggregated list of user activities and system alerts for exams managed by the admin.
    - Search activity logs by user email.
- **Live User Snapshots:** View near real-time webcam snapshots of users currently taking exams managed by the admin. Snapshots update frequently.
- **Disqualified Users List:** Review users automatically disqualified by the system for exams managed by the admin.
- **Manual Override:** Admins can review evidence (conceptual) and manually override disqualification decisions for users related to their exams.
- **Exam History:** Review past exams created by the admin, including a list of participants who started each exam.
- **Data Segregation:** Each admin manages their own set of whitelisted users, scheduled exams, activity logs, disqualified users, and live snapshots.

### User (Examinee) Features
- **Secure User Authentication:** Separate login and registration for examinees.
- **Exam Selection:** Users can see and select from exams they are whitelisted for and not disqualified from.
- **Pre-Exam System Check (Conceptual - Implemented as Camera Check):**
    - **Webcam Access:** Ensures the user grants camera permission before starting an exam.
- **AI-Powered Proctoring during Exam:**
    - **Webcam Monitoring:** The system captures webcam snapshots.
    - **Behavior Analysis (via Genkit AI):** Analyzes webcam snapshots for suspicious activities:
        - Multiple faces in the camera feed.
        - Looking away consistently.
        - Leaving the camera view.
        - Unauthorized sounds (conceptual, AI prompt includes this).
    - **Tab Switching Detection:** Flags if the user switches tabs or minimizes the window.
    - **Copy-Paste Detection:** Flags if the user attempts to copy or paste content.
- **Real-time Warnings:** Users receive warnings for detected violations.
- **Automatic Disqualification:** Users are automatically disqualified after exceeding a predefined number of violations (currently set to `MAX_VIOLATIONS = 3`).
- **Timed Exam:** Exams have a set duration, and the remaining time is displayed.
- **Exam Submission:** Users can submit their answers. The exam auto-submits if time runs out.
- **Score Display:** Shows the score upon exam completion.

## Tech Stack

- **Frontend:** Next.js (App Router), React, TypeScript
- **Styling:** Tailwind CSS, ShadCN UI components
- **Backend & Database:** Firebase (Authentication, Firestore)
- **AI Integration:** Google Genkit with Gemini models for behavior analysis.
- **State Management:** React Context API (for Auth)
- **Form Handling:** React Hook Form with Zod for validation

## Getting Started

### Prerequisites
- Node.js (v18 or later recommended)
- npm or yarn
- A Firebase project

### Setup Instructions

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd examguard-portal
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    # or
    yarn install
    ```

3.  **Set up Firebase:**
    *   Go to the [Firebase Console](https://console.firebase.google.com/).
    *   Create a new project (or use an existing one).
    *   **Authentication:**
        *   Go to "Authentication" in the sidebar.
        *   Click on the "Sign-in method" tab.
        *   Enable "Email/Password" provider.
    *   **Firestore Database:**
        *   Go to "Firestore Database" in the sidebar.
        *   Click "Create database".
        *   Start in **test mode** for development. **IMPORTANT:** Secure your database with security rules before going to production.
        *   Note your database location (e.g., `us-central`).
    *   **Project Settings:**
        *   Go to Project Settings (gear icon next to Project Overview).
        *   Under the "General" tab, find your "Web apps" section.
        *   If you don't have a web app, click "Add app" and select the web icon (`</>`). Register your app.
        *   Copy the `firebaseConfig` object.

4.  **Set up Environment Variables:**
    *   Create a `.env` file in the root of the project.
    *   Add your Firebase project configuration details to the `.env` file:
        ```env
        NEXT_PUBLIC_FIREBASE_API_KEY="YOUR_API_KEY"
        NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="YOUR_AUTH_DOMAIN"
        NEXT_PUBLIC_FIREBASE_PROJECT_ID="YOUR_PROJECT_ID"
        NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="YOUR_STORAGE_BUCKET"
        NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="YOUR_MESSAGING_SENDER_ID"
        NEXT_PUBLIC_FIREBASE_APP_ID="YOUR_APP_ID"

        # For Genkit AI (Google AI Studio / Vertex AI)
        # Create an API key in Google AI Studio: https://aistudio.google.com/app/apikey
        GOOGLE_API_KEY="YOUR_GOOGLE_AI_API_KEY"
        ```
    *   Replace `"YOUR_..."` with your actual Firebase and Google AI credentials.

5.  **Firebase Firestore Indexes:**
    The application requires specific Firestore indexes for optimal query performance and real-time updates. Some common ones are:
    *   `activityLogs` collection:
        *   `adminId (asc), timestamp (desc)`
        *   `adminId (asc), examId (asc), activityType (asc)` (for exam history participants)
    *   `disqualifiedUsers` collection:
        *   `adminId (asc)`
        *   `uid (asc), examId (asc), adminId (asc)` (for checking if a user is already disqualified for an exam by an admin)
    *   `liveSnapshots` collection:
        *   `adminId (asc), updatedAt (desc)`
    *   `scheduledExams` collection:
        *   `adminId (asc), scheduledTime (desc)`
    *   `whitelistedUsers` collection:
        *   `adminId (asc)`
        *   `email (asc), adminId (asc)` (used in admin portal for checking if a user is already whitelisted by a specific admin)
        *   `email (asc)` (used in user portal to find which admins have whitelisted the user)

    The application will show console warnings with direct links to create missing indexes if they are encountered during runtime. Follow these links or manually create them in the Firebase console under Firestore Database -> Indexes.

### Running the Application

1.  **Run the Genkit development server (for AI features):**
    Open a new terminal window and run:
    ```bash
    npm run genkit:dev
    # or
    # yarn genkit:dev
    ```
    This will typically start the Genkit server on `http://localhost:3400`.

2.  **Run the Next.js development server:**
    In another terminal window, run:
    ```bash
    npm run dev
    # or
    # yarn dev
    ```
    This will start the Next.js application, usually on `http://localhost:9002`.

3.  Open your browser and navigate to `http://localhost:9002`.

## Available Scripts

-   `npm run dev`: Starts the Next.js development server (usually on port 9002).
-   `npm run genkit:dev`: Starts the Genkit development server.
-   `npm run genkit:watch`: Starts the Genkit development server with hot-reloading for AI flow changes.
-   `npm run build`: Builds the application for production.
-   `npm run start`: Starts the production server.
-   `npm run lint`: Lints the codebase using Next.js's built-in ESLint configuration.
-   `npm run typecheck`: Runs TypeScript type checking.

## Folder Structure

A brief overview of the important directories:

```
examguard-portal/
├── src/
│   ├── ai/                     # Genkit AI flows and configuration
│   │   ├── flows/              # Specific AI flows (e.g., behavior analysis)
│   │   ├── dev.ts              # Genkit development server entry point
│   │   └── genkit.ts           # Genkit AI instance initialization
│   ├── app/                    # Next.js App Router: pages, layouts, etc.
│   │   ├── admin/              # Admin specific pages (login, register, dashboard)
│   │   ├── (user)/             # User specific pages (exam page, login, register) - using route groups
│   │   ├── globals.css         # Global styles and ShadCN theme variables
│   │   ├── layout.tsx          # Root layout
│   │   ├── page.tsx            # Main exam page for users
│   │   ├── questions-data.ts   # Sample exam questions
│   │   └── types.ts            # TypeScript type definitions
│   ├── components/             # Reusable UI components
│   │   ├── ui/                 # ShadCN UI components
│   │   ├── auth-guard.tsx      # Component for protecting routes based on auth state and role
│   │   └── logo.tsx            # Logo component
│   ├── contexts/               # React Context API providers
│   │   └── AuthContext.tsx     # Authentication context
│   ├── hooks/                  # Custom React hooks
│   │   ├── useAuth.ts          # Hook to access AuthContext
│   │   ├── use-mobile.tsx      # Hook to detect mobile viewports
│   │   └── use-toast.ts        # Hook for displaying toasts
│   ├── lib/                    # Utility functions and libraries
│   │   ├── firebase.ts         # Firebase SDK initialization
│   │   └── utils.ts            # General utility functions (e.g., `cn` for classnames)
├── public/                     # Static assets
├── .env                        # Environment variables (gitignored)
├── components.json             # ShadCN UI configuration
├── next.config.ts              # Next.js configuration
├── package.json
├── README.md                   # This file
└── tsconfig.json               # TypeScript configuration
```

## Contributing

Contributions are welcome! Please follow these steps:
1. Fork the repository.
2. Create a new branch (`git checkout -b feature/your-feature-name`).
3. Make your changes.
4. Commit your changes (`git commit -m 'Add some feature'`).
5. Push to the branch (`git push origin feature/your-feature-name`).
6. Open a Pull Request.

Please ensure your code adheres to the project's coding style and guidelines.

## License

This project is licensed under the MIT License. See the `LICENSE` file for details (if applicable, create one if needed).
(Currently, no LICENSE file exists, consider adding one like MIT or Apache 2.0 if making public)
