package nl.inl.corpuswebsite.utils;

import java.io.IOException;
import java.net.URL;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Keycloak-authz seems to be the library for the resource server.
 * We are NOT the resource server, we are a client.
 */
public class KeycloakUMA {
    private static class UMAConfig {
        @JsonProperty("token_endpoint")
        String tokenEndpoint;
        @JsonProperty("token_introspection_endpoint")
        String tokenIntrospectionEndpoint;
        @JsonProperty("resource_registration_endpoint")
        String resourceRegistrationEndpoint;
        @JsonProperty("permission_endpoint")
        String permissionEndpoint;
        @JsonProperty("policy_endpoint")
        String policyEndpoint;
    }

    final String keycloakUrl;
    final String realm;
    final String clientId;
    final String clientSecret;

    final UMAConfig umaConfig;

    public KeycloakUMA(String keycloakUrl, String realm, String clientId, String clientSecret)
            throws IOException {
        this.keycloakUrl = keycloakUrl;
        this.realm = realm;
        this.clientId = clientId;
        this.clientSecret = clientSecret;

        // do this synchronously, whatever.
        this.umaConfig = new ObjectMapper().readValue(new URL(this.keycloakUrl + "/realms/" + this.realm + "/.well-known/uma2-configuration"), UMAConfig.class);
        this.
    }


    public boolean canReadAnonymous(String resourceID) {

    }

//    public boolean canRead(@Nonnull String resourceID, @Nullable String bearer) {
//        try {
//            // if we have a user, request a ticket.
//
//
//
//            // create http get request to permissionEndpoint
//            // add query parameter "permission" with value "read"
//            // TODO cache tickets etc.
//
//            AuthRequest r = new AuthRequest()
//                    .url(this.config.tokenEndpoint)
//                    .query("permission", resourceID + "#read")
//                    .query("grant_type", "urn:ietf:params:oauth:grant-type:uma-ticket")
////                    .
//
//
//            final String url = this.config.permissionEndpoint + "?permission=" + resourceID + "#read";
//            Builder b = HttpRequest.newBuilder().uri(new URL(url).toURI());
//            if (StringUtils.isNotBlank(bearer)) b = b.header("Authorization", "Bearer " + bearer);
//
//                    .header("Authorization", "Bearer " + bearer)
//                    .header("Content-Type", "application/json")
//                    .build();
//
//
//
//
//        } catch (IOException | URISyntaxException e) {
//            throw new RuntimeException(e);
//        }
//
//    }
//
//    private final <T> T deserializeJSON(String s, Class<T> clazz) {
//        try {
//            return new ObjectMapper().readValue(s, clazz);
//        } catch (JsonProcessingException e) {
//            throw new RuntimeException(e);
//        }
    }
}
