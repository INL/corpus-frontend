package org.ivdnt.cf.rest;

import io.jsonwebtoken.*;
import jakarta.annotation.Priority;
import jakarta.ws.rs.HttpMethod;
import jakarta.ws.rs.Priorities;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.container.ContainerRequestFilter;
import org.apache.tomcat.util.codec.binary.Base64;

import java.io.IOException;
import java.security.Key;
import java.security.KeyFactory;
import java.security.NoSuchAlgorithmException;
import java.security.spec.InvalidKeySpecException;
import java.security.spec.X509EncodedKeySpec;

@Priority(Priorities.AUTHENTICATION)

public class KeycloakFilter implements ContainerRequestFilter {
    // For testing purposes. This is the public key of the keycloak "dev" realm, rs256 algorithm.
    @Override
    public void filter(ContainerRequestContext requestContext) throws IOException {
        if (requestContext.getMethod().equals(HttpMethod.OPTIONS)) {
            return;
        }
        try {
            String authorizationHeader = requestContext.getHeaderString("Authorization");

            Jwt jwt = Jwts.parserBuilder()
                    .setSigningKeyResolver(new SigningKeyResolverAdapter() {
                        @Override
                        public Key resolveSigningKey(JwsHeader header, Claims claims) {
                            byte[] keybytes = Base64.decodeBase64(pubkey);
                            X509EncodedKeySpec spec = new X509EncodedKeySpec(keybytes);
                            try {
                                return KeyFactory.getInstance("RSA").generatePublic(spec);
                            } catch (InvalidKeySpecException e) {
                                throw new RuntimeException(e);
                            } catch (NoSuchAlgorithmException e) {
                                throw new RuntimeException(e);
                            }
                        }
                    })
                    .build().parse(authorizationHeader);
            System.out.println(jwt);
        } catch (Exception e) {
            e.printStackTrace();
            requestContext.abortWith(jakarta.ws.rs.core.Response.status(401).build());
        }
    }
}
