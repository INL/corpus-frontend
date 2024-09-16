## Development setup

- clone [int components](https://github.com/INL/vue-component-library.git) into a folder next to the frontend e.g. `../int-components` (as from the root of this entire project).
- install the deps and build the component library project.
**TODO figure out and document how to make livereload work for the component library**



- Create corpus-frontend.properties
- Configure the frontend to use an external blacklab and load the javascript from the vite server
  In frontend.properties:
	```properties
	blsUrl=http://some-server.ivdnt.loc/blacklab-server/
	blsUrlExternal=http://some-server.ivdnt.loc/blacklab-server/
	# The path after the host should match the location of the source files on disk as seen from the frontend-vue3 directory. As of writing this is `src`
	jsPath=http://localhost:8081/src/
	```

- install deps
  `npm ci` in the `frontend-vue3` directory
- Start the vite server
  `npm run dev` in `frontend-vue3` 


- start the Java backend in IntelliJ/Eclipse

- go to `http://localhost:8080/corpus-frontend/` to access the Java backend
  It will serve the page scaffold (contentpage.vm) (basically an empty div and a link to the `main.ts` file from the build).
  The javascript will mount on the div and handle routing etc.

