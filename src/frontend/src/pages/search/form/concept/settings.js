import axios from 'axios'

// Vergeet niet dat er ook nog properties in /lexit2_config/Oefenen.properties moeten staan

/*
In productie zetten we alles op lex-it.inl.loc
*/

export const productie = document.location.hostname.includes("lex-it")

export const servers = {
    ato_corpora : 'https://corpora.ato.ivdnt.org/',
    ato_corpora_by_proxy : '/Oefenen',
    svatje: 'http://svatkc10.ivdnt.loc/',
    lexit_loc : 'http://lexit.inl.loc:8080',
    lexit_extern : 'http://lex-it.inl.nl/',
    onw_server : 'https://corpusoudnederlands.ivdnt.org/',
}

export const settings = {
  productie: productie,
  backend_server: productie ? '/Oefenen' : 'http://localhost:8080/Oefenen', // voor het opslaan van oefeningen
  lexicon_server: productie ? '/Oefenen' : 'http://localhost:8080/Oefenen', 
  corpus_server: productie ? servers.ato_corpora_by_proxy : servers.svatje,
  lexit_server: productie ? servers.lexit_extern :  servers.lexit_loc,
  onw_server: servers.onw_server,
  ato_corpora: servers.ato_corpora,

  initial_query_term : 'boek',
  database_instance : productie ? 'startkrant_prod'  : 'startkrant',

  credentials :    { auth: {
    username: 'fouke',
    password: 'narawaseraretakunai'
  } }
}


/*
Authenticatie

- Zet benodigde rol in web.xml (oefenen_access)
- Configureer gebruikers in tomcat-users.xml

*/