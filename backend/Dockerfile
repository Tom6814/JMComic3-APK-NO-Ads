FROM gradle:8.10-jdk21 AS build
WORKDIR /app
COPY . .
RUN gradle buildFatJar --no-daemon

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=build /app/build/libs/jmcomic-proxy.jar /app/jmcomic-proxy.jar
COPY --from=build /app/src/main/resources /app/resources
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/jmcomic-proxy.jar"]
