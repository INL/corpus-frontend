package org.ivdnt.cf;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.security.servlet.SecurityAutoConfiguration;

// Spring Security has a lot of automatically enabled options,
@SpringBootApplication(exclude = { SecurityAutoConfiguration.class })
public class CorpusFrontendApplication {

	public static void main(String[] args) {
		SpringApplication.run(CorpusFrontendApplication.class, args);
	}

}
