package org.ivdnt.cf;

import java.util.List;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
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
import org.springframework.web.cors.CorsConfiguration;

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
//                                .anyRequest().permitAll()
                )
                // Meh, need to allow any address. Allowed origins * doesn't work when client is running on another address or port.
                .cors(cors -> cors.configurationSource(request -> {
                    var corsConfiguration = new org.springframework.web.cors.CorsConfiguration();
                    corsConfiguration.setAllowedOrigins(java.util.List.of(request.getHeader("Origin")));
                    corsConfiguration.setAllowedMethods(java.util.List.of("*"));
                    corsConfiguration.setAllowedHeaders(java.util.List.of("*"));
                    return corsConfiguration;
                }))
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

    private static void enableCors(CorsConfigurer<HttpSecurity> cors) {
        cors.configurationSource(request -> {
            var corsConfiguration = new CorsConfiguration();
            corsConfiguration.setAllowedOrigins(List.of(request.getHeader("Origin")));
            corsConfiguration.setAllowedMethods(List.of("*"));
            corsConfiguration.setAllowedHeaders(List.of("*"));
            return corsConfiguration;
        });
    }

}
