# Base image of BlackLab to use.
ARG IMAGE_VERSION=latest

# Stage "builder": build the WAR file
#--------------------------------------
FROM maven:3.6-jdk-11 AS builder

# Copy source
WORKDIR /app

COPY src ./src


COPY . .

# Build the WAR.
# NOTE: make sure BuildKit is enabled (see https://docs.docker.com/develop/develop-images/build_enhancements/)
#       to be able to cache Maven libs so they aren't re-downloaded every time you build the image
RUN --mount=type=cache,target=/root/.m2  \
    --mount=type=cache,target=/app/src/frontend/node \
    --mount=type=cache,target=/app/src/frontend/node_modules \
    mvn --no-transfer-progress clean package


# Tomcat container with the WAR file
#--------------------------------------

FROM instituutnederlandsetaal/blacklab:$IMAGE_VERSION

# Where corpus-frontend.properties can be found. Can be overridden.
ARG CONFIG_ROOT=docker/config

# What the name of the Tomcat app (and therefore the URL should be). Can be overridden.
ARG TOMCAT_APP_NAME=corpus-frontend

COPY ${CONFIG_ROOT}/corpus-frontend.properties /etc/blacklab/

# Copy the WAR file
COPY --from=builder /app/target/corpus-frontend-*.war /usr/local/tomcat/webapps/${TOMCAT_APP_NAME}.war