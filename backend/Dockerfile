# Pulled from the AWS ECR public mirror of the official Docker image instead of
# docker.io to avoid Docker Hub auth/rate-limit 504s during the build.
FROM public.ecr.aws/docker/library/node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 8080
CMD ["node", "server.js"]