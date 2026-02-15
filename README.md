# Portfolio Server

Express + MongoDB backend for a portfolio website. Supports order management and image uploads to Cloudinary.

## Tech Stack
- Node.js + Express
- MongoDB (Atlas or local)
- Cloudinary (image hosting)
- Multer (multipart uploads)

## Requirements
- Node.js 18+ recommended
- A MongoDB connection string
- A Cloudinary account

## Setup
1. Install dependencies:
   ```bash
   npm i
   ```
2. Create a `.env` file in the project root:
   ```bash
   MONGODB_URI=your_mongodb_uri
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret
   CLOUDINARY_FOLDER=portfolio
   ```
3. Start the server:
   ```bash
   npm start
   ```

Server runs on `http://localhost:4000` by default.

## Scripts
- `npm start` runs `index.js`

## API Endpoints
### Health
- `GET /` → server status message

### Orders
- `POST /orders` → create order  
  Body: any JSON fields; server adds `isReviewed` and `createdAt`
- `GET /orders` → list orders (newest first)
- `PATCH /orders/:id` → update order fields

### Uploads (Cloudinary)
- `POST /uploads` → upload image  
  FormData fields:
  - `file` (required, image)
  - `category` (required): `cover | logo | manipulation | print | social | thumbnail`
  - `title` (optional)

  Response includes `imageUrl` and `publicId`.
- `GET /uploads` → list uploads (optional `?category=...`)
- `DELETE /uploads/:id` → delete upload + remove from Cloudinary

## Notes
- Uploaded images are stored in Cloudinary, not on disk.
- Cloudinary path uses `CLOUDINARY_FOLDER/<category>`.

## Render Deployment
1. Create a new Web Service and connect this repo.
2. Build command: `npm i`
3. Start command: `npm start`
4. Add environment variables from `.env` in Render dashboard.

## License
ISC
