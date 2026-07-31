package com.jmcomic.proxy

import io.ktor.client.*
import io.ktor.client.engine.cio.*
import io.ktor.client.plugins.*
import io.ktor.client.request.*
import io.ktor.client.statement.*
import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.cio.*
import io.ktor.server.engine.*
import io.ktor.server.plugins.compression.*
import io.ktor.server.plugins.cors.routing.*
import io.ktor.server.plugins.forwardedheaders.*
import io.ktor.server.plugins.statuspages.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import io.ktor.utils.io.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

fun main() {
    val port = System.getenv("PORT")?.toIntOrNull() ?: 8080

    embeddedServer(CIO, port = port, host = "0.0.0.0") {
        configureServer()
        configureRouting()
    }.start(wait = true)
}

fun Application.configureServer() {
    install(ForwardedHeaders)
    install(Compression)
    install(StatusPages) {
        exception<Throwable> { call, cause ->
            call.respondText(
                "Proxy error: ${cause.message}",
                status = HttpStatusCode.BadGateway
            )
        }
    }
    install(CORS) {
        anyHost()
        allowMethod(HttpMethod.Get)
        allowMethod(HttpMethod.Post)
        allowMethod(HttpMethod.Put)
        allowMethod(HttpMethod.Delete)
        allowMethod(HttpMethod.Options)
        allowHeader(HttpHeaders.ContentType)
        allowHeader(HttpHeaders.Authorization)
        allowHeader(HttpHeaders.Accept)
        allowHeader(HttpHeaders.Origin)
        allowHeader(HttpHeaders.XForwardedProto)
        allowCredentials = true
    }
}

fun Application.configureRouting() {
    val client = HttpClient(CIO) {
        engine {
            requestTimeout = 30_000
        }
        install(HttpTimeout) {
            requestTimeoutMillis = 30_000
            connectTimeoutMillis = 10_000
        }
    }

    routing {
        // Health check
        get("/api/health") {
            call.respondText("JMComic Proxy - OK")
        }

        // Generic proxy: /api/proxy/{target-host}/{path...}
        // Example: /api/proxy/18comic.vip/api/some-endpoint
        route("/api/proxy") {
            handle {
                val path = call.request.uri.removePrefix("/api/proxy/")
                // First segment is the target host, rest is the path
                val slashIndex = path.indexOf('/')
                val (targetHost, targetPath) = if (slashIndex > 0) {
                    path.substring(0, slashIndex) to path.substring(slashIndex)
                } else {
                    "18comic.vip" to "/$path"
                }

                val targetUrl = "https://$targetHost$targetPath"

                val proxyResponse: HttpResponse = client.request(targetUrl) {
                    method = call.request.httpMethod

                    // Copy relevant headers
                    call.request.headers.forEach { name, values ->
                        if (name.lowercase() !in setOf(
                                "host", "x-target-host", "connection",
                                "transfer-encoding", "content-length"
                            )
                        ) {
                            values.forEach { value -> header(name, value) }
                        }
                    }

                    // Forward body for methods with payload
                    if (call.request.httpMethod in setOf(
                            HttpMethod.Post, HttpMethod.Put, HttpMethod.Patch
                        )
                    ) {
                        setBody(call.receiveChannel())
                    }
                }

                // Copy response headers
                proxyResponse.headers.forEach { name, values ->
                    if (name.lowercase() !in setOf(
                            "transfer-encoding", "connection", "content-encoding"
                        )
                    ) {
                        values.forEach { value -> call.response.header(name, value) }
                    }
                }

                // Set content type
                call.response.header(
                    HttpHeaders.ContentType,
                    proxyResponse.contentType()?.toString() ?: ContentType.Application.OctetStream.toString()
                )

                // Stream response body
                val channel: ByteReadChannel = proxyResponse.bodyAsChannel()
                call.respond(object : OutgoingContent.ReadChannelContent() {
                    override val contentType: ContentType
                        get() = proxyResponse.contentType() ?: ContentType.Application.OctetStream
                    override val status: HttpStatusCode
                        get() = proxyResponse.status
                    override fun readFrom(): ByteReadChannel = channel
                })
            }
        }
    }
}
