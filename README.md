# FunnelVision

FunnelVision is a tool that analyzes landing pages and highlights elements that may be reducing conversions. It evaluates a page using the **FLOW framework** and provides feedback directly on the layout so that users can easily identify friction points, missing trust signals, or unclear messaging.

Instead of manually reviewing a landing page or paying for expensive audits, FunnelVision provides an automated way to identify common conversion issues and suggest improvements.

---

# Problem Statement

Landing pages are designed to convert visitors into users, customers, or leads. However, many pages fail to achieve their expected performance. The difficulty is that it is often unclear **why** a page is not converting well.

Some common issues include:

- Important calls-to-action are difficult to find
- The value proposition is unclear or buried in text
- Pages lack trust signals such as testimonials or authority indicators
- Visitors are not reassured about risk or uncertainty
- The page introduces unnecessary friction in forms or navigation

Identifying these problems usually requires experience in conversion optimization or hiring consultants to conduct manual audits.

For startups, creators, and small teams, this process is time-consuming and expensive. As a result, many landing pages continue to underperform without clear feedback on what should be improved.

---

# Business Idea

FunnelVision aims to make landing page analysis easier and more accessible.

Instead of relying on manual audits, the tool automatically:

1. Extracts the visual structure of a landing page
2. Identifies key elements such as text sections, buttons, and images
3. Evaluates these elements against common conversion principles
4. Highlights potential issues directly on the page screenshot

The goal is to help users quickly answer questions such as:

- Is the call-to-action visible enough?
- Is the value proposition clear?
- Does the page provide enough credibility?
- Are there unnecessary barriers preventing action?

By connecting feedback to specific page elements, users can quickly see **what to change and where it appears on the page**.

---

# Key Features

- Full page screenshot capture
- Automatic detection of text blocks, buttons, and images
- Element-level analysis using the FLOW framework
- Visual overlays highlighting problem areas
- Suggested improvements for each element
- Fast on-demand analysis without storing page data

---

# FLOW Framework

The analysis is based on four categories that commonly influence conversion performance.

## Friction

Friction refers to anything that makes it harder for users to take action.

Examples include:
- Hidden or unclear CTAs
- Complex forms
- Too many steps before completing an action
- Poor navigation structure

## Legitimacy

Legitimacy focuses on trust and credibility signals.

Examples include:
- Testimonials
- Social proof
- Authority indicators
- Brand credibility signals

## Offer Clarity

Offer clarity evaluates whether the user can quickly understand what is being offered.

Examples include:
- Jargon or unclear messaging
- Benefits hidden in long paragraphs
- Weak value propositions

## Willingness

Willingness measures whether the page addresses user hesitation.

Examples include:
- Lack of guarantees
- No clear risk reversal
- Missing FAQ sections
- Weak urgency signals

---

# How It Works

FunnelVision processes a landing page through several steps.

1. A user submits a landing page URL.
2. A headless browser loads the page and captures a full screenshot.
3. The page is scanned to detect visible elements such as text blocks, images, and buttons.
4. Each element is sent for analysis using a language model.
5. The model evaluates each element using the FLOW framework and common conversion principles.
6. The results are mapped back onto the screenshot so that users can visually inspect issues.

The final interface allows users to hover or click on elements to see:

- the detected issue
- why it might affect conversions
- suggested improvements

---

# System Architecture

The project is divided into three main components.

## Frontend

The frontend is responsible for:

- accepting landing page URLs
- displaying the page screenshot
- rendering overlay annotations
- providing an inspector panel with feedback

## Node.js Backend

The backend server coordinates the workflow.

Responsibilities include:

- receiving audit requests
- communicating with the scraper service
- batching page elements for analysis
- sending requests to the OpenAI API
- returning annotations to the frontend

## Python Scraper

The Python component performs page scraping using Playwright.

Its responsibilities include:

- launching a headless browser
- capturing a full page screenshot
- detecting bounding boxes for elements
- extracting visible text and button content
- returning structured page data to the backend

---

# System Flow

Browser  
→ Node.js server (Express)  
→ Python scraper (Playwright)  
→ Node.js server  
→ OpenAI API  
→ Analysis results returned to frontend

The analysis is performed on demand and does not require storing page data.

---

# Technology Stack

Frontend  
- JavaScript
- React / Next.js (depending on project setup)

Backend  
- Node.js
- Express

Scraping and Automation  
- Python
- Playwright

AI Analysis  
- OpenAI API

---

# Requirements

Before running the project, make sure the following are installed:

- Node.js 18 or later
- Python 3.12 or later
- Chromium browser for Playwright
- OpenAI API key

---

# Installation

Clone the repository:

```bash
git clone https://github.com/dakshmakkar6-code/funnel-vision.git
cd funnel-vision