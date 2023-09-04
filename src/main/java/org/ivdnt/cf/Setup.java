package org.ivdnt.cf;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.PropertySource;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.web.SecurityFilterChain;

// locations from least- to most-specific:
@Configuration
@PropertySource(value = "file:${user.home}/corpus-frontend.properties", ignoreResourceNotFound = true)
@PropertySource(value = "classpath:corpus-frontend.properties", ignoreResourceNotFound = true)
@PropertySource(value = "file:/etc/blacklab/corpus-frontend.properties", ignoreResourceNotFound = true)
@PropertySource(value = "file:/etc/corpus-frontend/corpus-frontend.properties", ignoreResourceNotFound = true)
@PropertySource(value = "file:${BLACKLAB_CONFIG_DIR}/corpus-frontend.properties", ignoreResourceNotFound = true)
@PropertySource(value = "file:${AUTOSEARCH_CONFIG_DIR}/corpus-frontend.properties", ignoreResourceNotFound = true)
@PropertySource(value = "file:${CORPUS_FRONTEND_CONFIG_DIR}/corpus-frontend.properties", ignoreResourceNotFound = true)
@EnableWebSecurity // I believe this is enabled by default, so this serves as a reminder
public class Setup {
    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http.authorizeHttpRequests(Customizer.withDefaults())
                .oauth2ResourceServer(oauth2ResourceServer ->
                                oauth2ResourceServer.jwt(Customizer.withDefaults())
                                        .
                )
                .cors(Customizer.withDefaults())
                .anonymous(Customizer.withDefaults())

                .

//                .anyRequest()
//                .authenticated()
//                .and()
//                .httpBasic();
        return http.build();
    }
}
