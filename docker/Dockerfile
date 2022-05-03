# Stage "builder": build the WAR file
#--------------------------------------
FROM maven:3.6-jdk-11 AS builder

# Copy source
WORKDIR /app
COPY . .

# Build the WAR.
# NOTE: make sure BuildKit is enabled (see https://docs.docker.com/develop/develop-images/build_enhancements/)
#       to be able to cache Maven libs so they aren't re-downloaded every time you build the image
RUN --mount=type=cache,target=/root/.m2 mvn --no-transfer-progress package


# Tomcat container with the WAR file
#--------------------------------------
FROM tomcat:9
ARG CONFIG_ROOT=docker/config
ARG TOMCAT_APP_NAME=corpus-frontend

COPY docker/config/corpus-frontend.properties /etc/blacklab/

# Copy the WAR file
COPY --from=builder /app/target/corpus-frontend-*.war /usr/local/tomcat/webapps/${TOMCAT_APP_NAME}.war