package org.ivdnt.cf;

import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.PropertySource;

// locations from least- to most-specific:
@Configuration
@PropertySource(value = "file:${user.home}/corpus-frontend.properties", ignoreResourceNotFound = true)
@PropertySource(value = "classpath:corpus-frontend.properties", ignoreResourceNotFound = true)
@PropertySource(value = "file:/etc/blacklab/corpus-frontend.properties", ignoreResourceNotFound = true)
@PropertySource(value = "file:/etc/corpus-frontend/corpus-frontend.properties", ignoreResourceNotFound = true)
@PropertySource(value = "file:${BLACKLAB_CONFIG_DIR}/corpus-frontend.properties", ignoreResourceNotFound = true)
@PropertySource(value = "file:${AUTOSEARCH_CONFIG_DIR}/corpus-frontend.properties", ignoreResourceNotFound = true)
@PropertySource(value = "file:${CORPUS_FRONTEND_CONFIG_DIR}/corpus-frontend.properties", ignoreResourceNotFound = true)
public class Setup {
}
