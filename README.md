# 0x04. Files Manager

## Project Overview

**0x04. Files Manager** is a backend development project focused on creating a platform that allows users to upload, manage, and view files. 
This project is built using modern web technologies including **JavaScript (ES6)**, **Node.js**, **Express.js**, **MongoDB**, **Redis**, and **Kue**. 
The platform is designed to handle user authentication, file uploads, file listing, permission management, and generating thumbnails for image files.



## Features

- **User Authentication:** Secure user registration and login with token-based authentication.
- **File Upload:** Users can upload files, which are stored in a MongoDB database.
- **File Listing:** Users can view a list of all their uploaded files.
- **Permission Management:** Users can manage file permissions, including public and private access.
- **Thumbnail Generation:** For image files, thumbnails are automatically generated and stored.

## Technologies Used

- **JavaScript (ES6):** Modern JavaScript features for cleaner, more maintainable code.
- **Node.js:** Server-side JavaScript runtime.
- **Express.js:** Web application framework for building APIs.
- **MongoDB:** NoSQL database for storing file metadata.
- **Redis:** In-memory data structure store, used for caching and job queuing.
- **Kue:** Priority job queue backed by Redis.
- **Babel:** JavaScript compiler for using ES6 features.

## Project Structure

The project follows a modular structure to keep the codebase organized and maintainable:

```plaintext
0x04-files_manager/
│
├── controllers/        # Controllers for handling HTTP requests
├── middlewares/        # Custom middleware for authentication and error handling
├── models/             # Mongoose models for MongoDB
├── routes/             # API routes
├── utils/              # Utility functions and helpers
├── services/           # Business logic and interaction with external services
├── workers/            # Kue workers for handling background jobs
├── config/             # Configuration files (e.g., database connections)
│
├── app.js              # Main application file
└── package.json        # NPM dependencies and scripts
