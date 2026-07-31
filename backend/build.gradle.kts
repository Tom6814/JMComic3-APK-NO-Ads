plugins {
    kotlin("jvm") version "2.1.0"
    kotlin("plugin.serialization") version "2.1.0"
    id("io.ktor.plugin") version "3.0.3"
    application
}

group = "com.jmcomic"
version = "1.0.0"

application {
    mainClass.set("com.jmcomic.proxy.ApplicationKt")
}

ktor {
    fatJar {
        archiveFileName.set("jmcomic-proxy.jar")
    }
    docker {
        jreVersion.set(io.ktor.plugin.features.JreVersion.JRE_21)
        localImageName.set("jmcomic-proxy")
        imageTag.set("latest")
        portMappings.set(listOf(
            io.ktor.plugin.features.DockerPortMapping(8080, 8080, io.ktor.plugin.features.TCP)
        ))
    }
}

dependencies {
    // Ktor Server
    implementation("io.ktor:ktor-server-core:3.0.3")
    implementation("io.ktor:ktor-server-netty:3.0.3")
    implementation("io.ktor:ktor-server-content-negotiation:3.0.3")
    implementation("io.ktor:ktor-server-cors:3.0.3")
    implementation("io.ktor:ktor-server-compression:3.0.3")
    implementation("io.ktor:ktor-server-status-pages:3.0.3")
    implementation("io.ktor:ktor-server-forwarded-header:3.0.3")

    // Ktor Client (for proxying)
    implementation("io.ktor:ktor-client-core:3.0.3")
    implementation("io.ktor:ktor-client-cio:3.0.3")
    implementation("io.ktor:ktor-client-content-negotiation:3.0.3")

    // Serialization
    implementation("io.ktor:ktor-serialization-kotlinx-json:3.0.3")

    // Logging
    implementation("ch.qos.logback:logback-classic:1.5.12")

    // Config
    implementation("io.ktor:ktor-server-config-yaml:3.0.3")
}

kotlin {
    jvmToolchain(21)
}
