FROM node:20-alpine

# Install curl for healthchecks
RUN apk add --no-cache curl

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY src ./src

# Create Data directory (will be mounted from host)
RUN mkdir -p /app/Data

EXPOSE 8000

# Set environment
ENV NODE_ENV=production

CMD ["npm", "start"]
