package org.ivdnt.cf;

import org.apache.velocity.app.VelocityEngine;
import org.ivdnt.cf.utils2.BlackLabApi;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.concurrent.ConcurrentMapCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.PropertySource;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.CorsConfigurer;
import org.springframework.security.config.annotation.web.configurers.CsrfConfigurer;
import org.springframework.security.config.annotation.web.configurers.LogoutConfigurer;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.context.annotation.RequestScope;
import org.springframework.web.cors.CorsConfiguration;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.util.Properties;

// locations from least- to most-specific:
@Configuration
@PropertySource(value = "file:${user.home}/corpus-frontend.properties", ignoreResourceNotFound = true)
@PropertySource(value = "classpath:corpus-frontend.properties", ignoreResourceNotFound = true)
@PropertySource(value = "file:/etc/blacklab/corpus-frontend.properties", ignoreResourceNotFound = true)
@PropertySource(value = "file:/etc/corpus-frontend/corpus-frontend.properties", ignoreResourceNotFound = true)
@PropertySource(value = "file:${BLACKLAB_CONFIG_DIR}/corpus-frontend.properties", ignoreResourceNotFound = true)
@PropertySource(value = "file:${AUTOSEARCH_CONFIG_DIR}/corpus-frontend.properties", ignoreResourceNotFound = true)
@PropertySource(value = "file:${CORPUS_FRONTEND_CONFIG_DIR}/corpus-frontend.properties", ignoreResourceNotFound = true)
@EnableWebSecurity // is enabled by default, but let this be a reminder.
@EnableCaching
public class Setup {

    /**
     * Because we specify {@link EnableWebSecurity}, a LOT of default configuration is applied.
     * For more information, see documentation inside the {@link HttpSecurity} class.
     * Many of the configuration functions will document that they are enabled.
     * @param http
     * @return
     * @throws Exception
     */
    @Bean
    @ConditionalOnProperty(name = "cf.security.enabled", havingValue = "true")
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        return http
                // This section configures only what urls should be accessible by who,
                // It doesn't configure how the user is actually determined (authentication).
                .authorizeHttpRequests(authz -> authz
//                        .requestMatchers(HttpMethod.GET, "/foos/**").hasAuthority("SCOPE_read")
//                        .requestMatchers(HttpMethod.POST, "/foos").hasAuthority("SCOPE_write")
                                .anyRequest().permitAll()
                )
                .cors(Setup::enableCors)
                .oauth2ResourceServer(oauth2 -> oauth2
                                .jwt(Customizer.withDefaults())
                            // this only works with confidential clients, not with public clients
                            // And confidential clients are not allowed to be used from a browser (they need a client_secret, which is obviously not secret when sent to the client in browser)
                            // But if we had a confidential client, we could use this to enable opaque token support.
//                        .opaqueToken(opaqueToken -> opaqueToken.introspectionUri("http://localhost:8080/auth/realms/dev/protocol/openid-connect/token/introspect"))
                )
                .csrf(CsrfConfigurer::disable) // is enabled by default, but we don't need it
                .logout(LogoutConfigurer::disable) // is enabled by default, but to logout we just call the IDP directly from the frontend
                .build();
    }

    @Bean
    @ConditionalOnProperty(name = "cf.security.enabled", havingValue = "false", matchIfMissing = true)
    public SecurityFilterChain permitAllFilterChain(HttpSecurity http) throws Exception {
        return http
                .authorizeHttpRequests(requests -> requests.anyRequest().permitAll())
                .csrf(CsrfConfigurer::disable)
                .cors(Setup::enableCors)
                .build();
    }

    /** Meh, need to allow any address. Allowed origins * doesn't work when client is running on another address or port. */
     private static void enableCors(CorsConfigurer<HttpSecurity> cors) {
        cors.configurationSource(request -> {
            String origin = request.getHeader("Origin");
            if (origin == null) return null; // origin not included on same-site requests, i.e. the happy path.
            var corsConfiguration = new CorsConfiguration();
            corsConfiguration.setAllowedOrigins(java.util.List.of(origin));
            corsConfiguration.setAllowedMethods(java.util.List.of("*"));
            corsConfiguration.setAllowedHeaders(java.util.List.of("*"));
            return corsConfiguration;
        });
    }

    @Bean(name="api")
    @RequestScope
    public BlackLabApi blacklabApi(GlobalConfigProperties config, HttpServletRequest request, HttpServletResponse response) {
    	return new BlackLabApi(config.getBlsUrl(), request, response);
    }

    @Bean(name="cacheManager")
    public CacheManager cacheManager() {
        return new ConcurrentMapCacheManager();
    }

    @Bean
    public VelocityEngine velocityEngine() {
        Properties properties = new Properties();
        properties.setProperty("input.encoding", "UTF-8");
        properties.setProperty("output.encoding", "UTF-8");
        properties.setProperty("resource.loader", "class");
        properties.setProperty("class.resource.loader.class", "org.apache.velocity.runtime.resource.loader.ClasspathResourceLoader");
        VelocityEngine velocityEngine = new VelocityEngine(properties);
        return velocityEngine;
    }
}
