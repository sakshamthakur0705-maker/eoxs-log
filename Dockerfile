# Use Node.js 18 with Playwright dependencies
FROM mcr.microsoft.com/playwright:v1.44.0-jammy

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies using npm install (more flexible than npm ci)
RUN npm install --omit=dev

# Install Playwright browsers
RUN npx playwright install chromium

# Copy application code
COPY . .

# Create output directories
RUN mkdir -p /app/screenshots /app/output

# Set environment variables
ENV NODE_ENV=production
ENV HEADLESS=true

# Expose port
EXPOSE 3000

# Run the server
CMD ["node", "server.js"]