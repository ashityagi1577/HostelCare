-- ====================================================================
-- HostelCare Database Schema
-- Database: hostelcare_db
-- Description: DDL definitions for users, technicians, complaints, 
--              status audit logs, and student feedback.
-- ====================================================================

-- 1. USERS TABLE
-- Stores credentials and profiles for Students, Hostel Staff, and Wardens/Admins.
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('student', 'staff', 'admin') NOT NULL DEFAULT 'student',
    hostel_block VARCHAR(50) NULL,
    room_no VARCHAR(20) NULL,
    phone VARCHAR(20) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_role (role),
    INDEX idx_user_hostel_block (hostel_block)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. TECHNICIANS TABLE
-- Directory of maintenance staff and workers available for task assignments.
CREATE TABLE IF NOT EXISTS technicians (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    trade ENUM('Electrical', 'Plumbing', 'Carpentry', 'Cleaning', 'WiFi_Internet', 'General') NOT NULL,
    phone VARCHAR(20) NOT NULL,
    is_available BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_tech_trade (trade),
    INDEX idx_tech_available (is_available)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. COMPLAINTS TABLE
-- Core table storing maintenance requests, photo evidence, priority, and progress status.
CREATE TABLE IF NOT EXISTS complaints (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ticket_no VARCHAR(30) NOT NULL UNIQUE,
    student_id INT NOT NULL,
    category ENUM('Electrical', 'Plumbing', 'Carpentry', 'Cleaning', 'WiFi_Internet', 'Other') NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    photo_url VARCHAR(255) NULL,
    priority ENUM('Low', 'Medium', 'High', 'Emergency') NOT NULL DEFAULT 'Medium',
    status ENUM('Pending', 'Assigned', 'In_Progress', 'Resolved', 'Closed') NOT NULL DEFAULT 'Pending',
    assigned_tech_id INT NULL,
    estimated_date DATETIME NULL,
    resolution_notes TEXT NULL,
    resolved_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_tech_id) REFERENCES technicians(id) ON DELETE SET NULL,
    INDEX idx_complaint_ticket (ticket_no),
    INDEX idx_complaint_student (student_id),
    INDEX idx_complaint_status (status),
    INDEX idx_complaint_category (category),
    INDEX idx_complaint_priority (priority),
    INDEX idx_complaint_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. COMPLAINT_LOGS TABLE
-- Status audit trail tracking every transition from Submitted -> Assigned -> In Progress -> Resolved -> Closed.
CREATE TABLE IF NOT EXISTS complaint_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    complaint_id INT NOT NULL,
    action VARCHAR(100) NOT NULL,
    previous_status ENUM('Pending', 'Assigned', 'In_Progress', 'Resolved', 'Closed') NULL,
    new_status ENUM('Pending', 'Assigned', 'In_Progress', 'Resolved', 'Closed') NOT NULL,
    updated_by_user_id INT NULL,
    remarks TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE,
    FOREIGN KEY (updated_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_log_complaint (complaint_id),
    INDEX idx_log_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. FEEDBACK TABLE
-- Post-resolution student ratings (1 to 5 stars) and review comments.
CREATE TABLE IF NOT EXISTS feedback (
    id INT AUTO_INCREMENT PRIMARY KEY,
    complaint_id INT NOT NULL UNIQUE,
    student_id INT NOT NULL,
    rating TINYINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comments TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_feedback_complaint (complaint_id),
    INDEX idx_feedback_rating (rating)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

