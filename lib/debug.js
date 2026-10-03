// Rule-based stack trace / error analyzer. No LLM needed.
const RULES = [
  {
    id: 'segfault', name: 'Segmentation fault (SIGSEGV)', lang: 'C/C++/native',
    re: /segmentation fault|sigsegv|core dumped|signal 11\b|exc_bad_access|access violation reading location|0xc0000005/i,
    cause: 'The process touched memory it does not own: dereferencing a NULL/dangling pointer, reading past an array, use-after-free, or a stack overflow from runaway recursion.',
    fix: 'Rebuild with `-g -fsanitize=address,undefined` and rerun; ASan prints the exact line. Or `gdb ./app core` then `bt`. Initialise pointers to NULL, check them before use, and set them to NULL after `free()`.',
    roast: ['My namesake! You did it. You reached the final form of bug.', 'Core dumped. Honestly, same.', 'The CPU looked at your pointer and chose violence.'],
  },
  {
    id: 'rust-borrow', name: 'Rust borrow checker error', lang: 'Rust',
    re: /error\[E0(499|502|505|506|382|384|596|597|716|503|373)\]|cannot borrow .* as mutable|borrowed value does not live long enough|use of moved value|value borrowed here after move/i,
    cause: 'You hold a reference while also mutating/moving the same value (E0499/E0502), use something after moving it (E0382), or a reference outlives its owner (E0597/E0716).',
    fix: 'Shrink the borrow scope (finish using the `&` before the `&mut`), `.clone()` the small value, pass references instead of ownership, or restructure with indices / `Rc<RefCell<T>>` for shared mutation. `rustc --explain E0XXX` gives the exact pattern.',
    roast: ['The borrow checker isn\'t angry, just disappointed.', 'You tried to share and mutate at the same time. Rust said no, like a responsible adult.'],
  },
  {
    id: 'rust-panic', name: 'Rust panic', lang: 'Rust',
    re: /thread '.*' panicked at|called `(Option|Result)::unwrap\(\)` on an? `(None|Err)/i,
    cause: 'An `unwrap()`/`expect()` hit a `None`/`Err`, or an index was out of bounds, and the thread panicked.',
    fix: 'Replace `unwrap()` with `?` or a `match`/`if let`, and handle the error case. Run with `RUST_BACKTRACE=1` to see where it happened.',
    roast: ['`.unwrap()`: the Rust equivalent of "trust me bro".'],
  },
  {
    id: 'js-undefined', name: 'TypeError: cannot read properties of undefined/null', lang: 'JavaScript/TypeScript',
    re: /cannot read propert(y|ies) of (undefined|null)|undefined is not an object|is not a function|cannot set propert(y|ies) of (undefined|null)|null is not an object/i,
    cause: 'You accessed a property/method on a value that is `undefined` or `null`: data not loaded yet (async), a typo in the key, a missing return, or an API response with a different shape.',
    fix: 'Log the object right before the crash line. Use optional chaining (`obj?.a?.b`) and defaults (`?? []`), `await` the async call, and validate API responses. With TypeScript, turn on `"strict": true`.',
    roast: ['`undefined` strikes again. JavaScript\'s favorite plot twist.', 'You asked undefined for a property. undefined has nothing. undefined IS nothing.'],
  },
  {
    id: 'js-ref', name: 'ReferenceError: x is not defined', lang: 'JavaScript',
    re: /referenceerror: .* is not defined|referenceerror: cannot access '.*' before initialization/i,
    cause: 'A variable is used before it is declared (temporal dead zone), is misspelled, is out of scope, or a global (e.g. `window`, `require`) does not exist in this runtime.',
    fix: 'Check spelling and scope; declare before use. If it\'s `require`/`module` in ESM, use `import`. If it\'s `window`/`document` in Node/SSR, guard with `typeof window !== "undefined"`.',
    roast: ['The variable is not defined. Neither is your naming convention.'],
  },
  {
    id: 'npe', name: 'NullPointerException', lang: 'Java/Kotlin',
    re: /nullpointerexception|kotlin\.KotlinNullPointerException/i,
    cause: 'A method or field was accessed on a `null` reference: uninitialized field, missing dependency injection, a map lookup that returned null, or a method that returns null on failure.',
    fix: 'Read the "Cannot invoke ... because X is null" part (Java 14+ helpful NPEs) to see which reference. Initialise it, use `Objects.requireNonNull` early, or `Optional` for maybe-values.',
    roast: ['Tony Hoare called null his billion-dollar mistake. You just made it a billion and one.'],
  },
  {
    id: 'py-keyerror', name: 'KeyError', lang: 'Python',
    re: /\bkeyerror\b/i,
    cause: 'A dict was accessed with a key it does not contain: typo, different casing, data missing in the input, or a JSON shape you didn\'t expect.',
    fix: 'Use `d.get("key", default)` or check `if "key" in d`. Print `d.keys()` right before the line to see what is actually there.',
    roast: ['The dictionary has never heard of this key. Neither has anyone else.'],
  },
  {
    id: 'py-index', name: 'IndexError: list index out of range', lang: 'Python',
    re: /indexerror|list index out of range|tuple index out of range/i,
    cause: 'You indexed past the end of a list/tuple (off-by-one, empty list, or `range(len(x)+1)`).',
    fix: 'Check `len(x)` before indexing, iterate with `for item in x` / `enumerate(x)` instead of indices, and handle the empty case.',
    roast: ['Off-by-one: the only bug that\'s been in every language since 1957.'],
  },
  {
    id: 'oob', name: 'Index out of bounds', lang: 'Java/C#/Go/JS',
    re: /arrayindexoutofboundsexception|indexoutofrangeexception|index out of range \[\d+\] with length|rangeerror: invalid array length|stringindexoutofbounds/i,
    cause: 'An array/slice was accessed with an index that is negative or >= its length.',
    fix: 'Guard with a length check, prefer for-each loops, and look for `<=` that should be `<` in your loop condition.',
    roast: ['Arrays start at 0. Your loop starts at "vibes".'],
  },
  {
    id: 'py-import', name: 'ImportError / ModuleNotFoundError', lang: 'Python',
    re: /modulenotfounderror|importerror|no module named/i,
    cause: 'The package is not installed in the interpreter you are running, you are in the wrong virtualenv, the package name differs from the import name, or there\'s a circular import.',
    fix: 'Run `python -m pip install <package>` with the SAME python you run the script with (`which python`). Activate your venv. For "cannot import name", check for circular imports or a file shadowing the package (e.g. your own `requests.py`).',
    roast: ['Python looked everywhere for that module. It\'s in a different venv, living its best life.'],
  },
  {
    id: 'py-attr-none', name: "AttributeError: 'NoneType' object has no attribute", lang: 'Python',
    re: /'nonetype' object (has no attribute|is not subscriptable|is not iterable)/i,
    cause: 'A function returned `None` (forgot `return`, regex didn\'t match, `.get()` missed, in-place method like `list.sort()` returns None) and you used the result.',
    fix: 'Find which call returned None (print it), add the missing `return`, or check `if result is None:` before using it.',
    roast: ['None: Python\'s way of saying "I did nothing, and I\'m proud of it."'],
  },
  {
    id: 'py-type', name: 'Python TypeError', lang: 'Python',
    re: /typeerror: (unsupported operand|can only concatenate|.* takes \d+ positional argument|.* missing \d+ required positional|.*object is not callable|.*must be str)/i,
    cause: 'Wrong type or wrong number of arguments: e.g. `"a" + 1`, calling a function with too few/many args, or shadowing a function name with a variable.',
    fix: 'Convert explicitly (`str(x)`, `int(x)`), check the function signature (missing `self`?), and make sure you didn\'t overwrite a builtin like `list = [...]`.',
    roast: ['Python is dynamically typed, not "anything goes" typed.'],
  },
  {
    id: 'py-indent', name: 'IndentationError / SyntaxError', lang: 'Python',
    re: /indentationerror|taberror|unexpected indent|unindent does not match/i,
    cause: 'Mixed tabs and spaces, or a block that is not indented consistently.',
    fix: 'Configure your editor to insert 4 spaces, run `python -m tabnanny file.py`, or let `black`/`ruff format` normalise the file.',
    roast: ['Tabs vs spaces: the war you didn\'t know you were fighting.'],
  },
  {
    id: 'cors', name: 'CORS policy error', lang: 'Browser/HTTP',
    re: /\bcors\b|access-control-allow-origin|blocked by cors policy|preflight request/i,
    cause: 'The browser blocked a cross-origin request because the SERVER did not send the right `Access-Control-Allow-*` headers (or the preflight OPTIONS request failed). It is not a frontend bug.',
    fix: 'Fix it on the server: send `Access-Control-Allow-Origin: https://your-frontend` (+ `-Methods`/`-Headers` for preflight), e.g. `app.use(cors({ origin: "https://your-frontend" }))` in Express. In dev, use your bundler\'s proxy. Never use `*` with credentials.',
    roast: ['CORS: the browser protecting you from yourself since 2014.', 'Your frontend and backend are in a long-distance relationship and the browser is the overprotective parent.'],
  },
  {
    id: 'econnrefused', name: 'ECONNREFUSED / connection refused', lang: 'Network',
    re: /econnrefused|connection refused|connect: connection refused|could not connect to server|errno 111|actively refused/i,
    cause: 'Nothing is listening on that host:port: the service (DB, API, Redis) is not running, it listens on another port/interface, or inside Docker `localhost` points to the container itself.',
    fix: 'Check the service is up (`ss -ltnp | grep <port>` / `docker ps`). In Docker Compose use the service name as host (e.g. `postgres:5432`) instead of `localhost`. Bind servers to `0.0.0.0` when accessed from outside.',
    roast: ['You knocked. Nobody was home. Nobody has been home for a while.'],
  },
  {
    id: 'eaddrinuse', name: 'EADDRINUSE / port already in use', lang: 'Network',
    re: /eaddrinuse|address already in use|port \d+ is already in use|bind: address already in use/i,
    cause: 'Another process (often an old instance of your own server) is already listening on that port.',
    fix: 'Find it with `lsof -i :PORT` (or `ss -ltnp`), stop it (`kill <pid>`), or start on another port (`PORT=3001`).',
    roast: ['Your server is fighting its own ghost for the port.'],
  },
  {
    id: 'oom', name: 'Out of memory', lang: 'Any',
    re: /out of memory|javascript heap out of memory|outofmemoryerror|memoryerror|killed process .* \(oom|oomkilled|cannot allocate memory|std::bad_alloc|exit code 137/i,
    cause: 'The process exceeded available/allowed memory: a leak (growing caches, listeners never removed), loading a huge file at once, or a container memory limit that is too low (exit 137 = SIGKILL by OOM killer).',
    fix: 'Stream/chunk large data instead of loading it whole, look for unbounded arrays/caches, profile with a heap snapshot (Node: `--inspect`, Python: `tracemalloc`). Raise limits only after: `NODE_OPTIONS=--max-old-space-size=4096`, Java `-Xmx`, container `memory:` limit.',
    roast: ['Your app ate all the RAM and is still hungry.', 'Memory leak so big it has its own weather system.'],
  },
  {
    id: 'stackoverflow', name: 'Stack overflow / maximum recursion', lang: 'Any',
    re: /maximum call stack size exceeded|stackoverflowerror|recursionerror|maximum recursion depth|stack overflow/i,
    cause: 'Infinite or too-deep recursion: a missing/incorrect base case, two functions calling each other, or a getter/setter that calls itself.',
    fix: 'Check the base case of the recursive function at the top of the trace (the repeating frames). Convert deep recursion to a loop with an explicit stack. For setters, write to a backing field (`this._x`), not `this.x`.',
    roast: ['You called yourself so many times the stack filed a restraining order.'],
  },
  {
    id: 'go-nil', name: 'Go nil pointer dereference / panic', lang: 'Go',
    re: /invalid memory address or nil pointer dereference|panic: runtime error|assignment to entry in nil map/i,
    cause: 'A nil pointer, nil map or nil interface was used: the value was never initialised, or an error was ignored and the zero value used.',
    fix: 'Check `if err != nil { return err }` after every call, initialise maps with `make(map[K]V)`, and guard pointers with `if p == nil`.',
    roast: ['`if err != nil` exists for a reason. That reason just crashed your program.'],
  },
  {
    id: 'module-not-found-js', name: 'Cannot find module', lang: 'Node.js',
    re: /cannot find module|module not found: (error: )?can't resolve|err_module_not_found|err_require_esm/i,
    cause: 'The dependency isn\'t installed, the import path/case is wrong (Linux is case-sensitive), or you mix CommonJS `require` with an ESM-only package.',
    fix: 'Run `npm install` (or `npm i <pkg>`), check the path and filename casing, and for ERR_REQUIRE_ESM switch to `import` / `"type": "module"` or dynamic `await import()`.',
    roast: ['The module is not missing. It\'s just in a different node_modules, in a different universe.'],
  },
  {
    id: 'unhandled-promise', name: 'Unhandled promise rejection', lang: 'JavaScript',
    re: /unhandledpromiserejection|unhandled promise rejection|uncaught \(in promise\)/i,
    cause: 'A Promise rejected and nobody `await`ed it inside try/catch or attached `.catch()`.',
    fix: 'Wrap `await` calls in `try { ... } catch (e) { ... }`, add `.catch()` to fire-and-forget promises, and in Express use an async error handler.',
    roast: ['You made a promise and didn\'t handle the rejection. Relatable, but still a bug.'],
  },
  {
    id: 'json-parse', name: 'JSON parse error', lang: 'Any',
    re: /unexpected token .* in json|json\.decoder\.jsondecodeerror|unexpected end of json input|is not valid json|syntaxerror: json\.parse/i,
    cause: 'You tried to parse something that is not JSON: usually an HTML error page (e.g. a 404/500), an empty body, or a trailing comma.',
    fix: 'Log the raw response text and status before parsing. Check `res.ok` / the status code and the `Content-Type` header first, then call `res.json()`.',
    roast: ['You asked for JSON and got an HTML error page. Classic catfish.'],
  },
  {
    id: 'git-conflict', name: 'Git merge conflict', lang: 'Git',
    re: /<<<<<<< head|merge conflict in|automatic merge failed|conflict \(content\)/i,
    cause: 'Two branches changed the same lines and git refuses to guess.',
    fix: 'Open each conflicted file, keep the right parts between `<<<<<<<`, `=======`, `>>>>>>>`, delete the markers, then `git add <file>` and `git commit` (or `git merge --abort` to bail out).',
    roast: ['Git asked you to pick a side. Choose wisely.'],
  },
  {
    id: 'permission', name: 'Permission denied', lang: 'OS',
    re: /eacces|permission denied|operation not permitted|eperm/i,
    cause: 'The process lacks rights for that file/port/socket: wrong owner, missing execute bit, port < 1024 without root, or a read-only mount.',
    fix: 'Check with `ls -l`, fix ownership (`chown`) or mode (`chmod +x script.sh`), use a port >= 1024. Do NOT fix it with `sudo npm install -g`; use a Node version manager instead.',
    roast: ['Permission denied. The computer has boundaries. Respect them.'],
  },
  {
    id: 'ssl', name: 'TLS/SSL certificate error', lang: 'Network',
    re: /certificate verify failed|unable to verify the first certificate|self[- ]signed certificate|err_cert|ssl: certificate|unable_to_get_issuer_cert/i,
    cause: 'The client doesn\'t trust the server\'s certificate chain: self-signed cert, missing intermediate certificate, outdated CA bundle, or a corporate proxy intercepting TLS.',
    fix: 'Fix the server chain (serve the full chain), update CA certs (`update-ca-certificates`, `pip install -U certifi`), or point to your corporate CA (`NODE_EXTRA_CA_CERTS`). Don\'t ship `rejectUnauthorized: false`.',
    roast: ['"Just disable SSL verification" is how security incidents get their origin story.'],
  },
  {
    id: 'timeout', name: 'Timeout', lang: 'Network',
    re: /etimedout|\btimed out\b|\btimeout error|deadline exceeded|504 gateway/i,
    cause: 'The other side is too slow or unreachable: firewall/security group dropping packets, wrong host, an overloaded service, or a query that takes too long.',
    fix: 'Check reachability (`curl -v`, `nc -vz host port`), firewall rules, and DNS. Add sensible timeouts + retries with backoff, and profile the slow query/endpoint.',
    roast: ['Your request is still waiting. Like your PR reviews.'],
  },
  {
    id: 'dns', name: 'DNS resolution failure', lang: 'Network',
    re: /enotfound|getaddrinfo|name or service not known|could not resolve host|nodename nor servname/i,
    cause: 'The hostname can\'t be resolved: typo, no network/DNS, a Docker service name used outside Docker, or a missing `/etc/hosts` entry.',
    fix: 'Check the hostname spelling (`nslookup host`), your network, and whether you need the Compose service name vs `localhost`.',
    roast: ['DNS: it\'s always DNS. Even when it isn\'t, it is.'],
  },
  {
    id: 'sql-syntax', name: 'SQL error', lang: 'SQL',
    re: /syntax error at or near|you have an error in your sql syntax|sqlite_error|relation ".*" does not exist|no such table|duplicate key value violates unique constraint|deadlock detected/i,
    cause: 'Invalid SQL, a missing table/migration, a unique constraint violation, or a deadlock between concurrent transactions.',
    fix: 'Run your migrations, print the final SQL, and use parameterised queries (never string concatenation). For unique violations use upsert (`ON CONFLICT`); for deadlocks lock rows in a consistent order and retry.',
    roast: ['The database rejected you. It has standards.'],
  },
  {
    id: 'docker', name: 'Docker error', lang: 'Docker',
    re: /cannot connect to the docker daemon|no space left on device|exec format error|pull access denied/i,
    cause: 'Docker daemon not running/permitted, disk full, an image built for a different CPU architecture (arm64 vs amd64), or a wrong/private image name.',
    fix: 'Start the daemon (`systemctl start docker`) / add yourself to the docker group, `docker system prune`, build with `--platform linux/amd64`, and check the image name + `docker login`.',
    roast: ['It works in my container. Your container. Some container. Not this one.'],
  },
  {
    id: 'cpp-undefined-ref', name: 'Linker error: undefined reference', lang: 'C/C++',
    re: /undefined reference to|unresolved external symbol|ld returned 1 exit status|symbol\(s\) not found/i,
    cause: 'A function is declared but its definition isn\'t linked: missing source file in the build, missing `-l<lib>`, wrong library order, or C++ name mangling (missing `extern "C"`).',
    fix: 'Add the .c/.cpp file or library to the link step (`-lm`, `-lpthread`, `target_link_libraries` in CMake), put libraries after objects, and wrap C headers in `extern "C"`.',
    roast: ['You declared a function and then ghosted it.'],
  },
  {
    id: 'http-4xx5xx', name: 'HTTP error status', lang: 'HTTP',
    re: /\b(401|403) (unauthorized|forbidden)|status code (401|403|404|500|502|503)|\b(500 internal server error|502 bad gateway|503 service unavailable)/i,
    cause: '401/403: missing or invalid credentials/permissions. 404: wrong URL or route. 500: the server crashed (check ITS logs). 502/503: upstream down or overloaded.',
    fix: 'Log the full request (URL, method, headers minus secrets) and the response body. For 401 check the `Authorization` header/token expiry; for 5xx read the server logs, not the client.',
    roast: ['The server is speaking to you in numbers. None of them are compliments.'],
  },
];

function extractLocation(text) {
  const pats = [
    /File "([^"]+)", line (\d+)/g,                        // Python
    /at .*?\(?((?:[A-Za-z]:)?[^\s():]+\.[cm]?[jt]sx?):(\d+):(\d+)\)?/g, // JS
    /at [\w$.]+\(([\w$]+\.(?:java|kt)):(\d+)\)/g,        // Java
    /-->\s*([^\s:]+\.rs):(\d+):(\d+)/g,                    // Rust
    /([^\s:]+\.go):(\d+)/g,                                // Go
    /([^\s:]+\.(?:c|cc|cpp|h|hpp)):(\d+)(?::\d+)?/g,       // C/C++
  ];
  for (const re of pats) {
    const all = [...text.matchAll(re)];
    if (all.length) {
      // Python: last frame is the crash site; JS/Java: first frame
      const m = re.source.startsWith('File') ? all[all.length - 1] : all[0];
      if (/node_modules|node:internal/.test(m[1]) && all.length > 1) continue;
      return `${m[1]}:${m[2]}`;
    }
  }
  return null;
}

function looksLikeError(text) {
  return RULES.some(r => r.re.test(text)) ||
    /(traceback \(most recent call last\)|exception|error:|\berror\b|\bat .+:\d+:\d+|panicked|fatal|stack trace)/i.test(text);
}

function debugError(text) {
  const t = String(text || '').slice(0, 20000);
  const seed = t.length;
  const hits = RULES.filter(r => r.re.test(t));
  const loc = extractLocation(t);
  if (!hits.length) {
    return {
      matched: false,
      name: 'Unknown error',
      cause: 'I don\'t have a rule for this one yet. Read the FIRST line that says "error" and the first stack frame that points to YOUR code (not node_modules / site-packages).',
      fix: 'Reproduce it with the smallest possible input, search the exact error message in quotes, and add logging right before the line in the stack trace.',
      roast: 'Even I can\'t parse this. And I\'m literally made of error messages.',
      location: loc,
    };
  }
  const r = hits[0];
  return {
    matched: true, id: r.id, name: r.name, lang: r.lang,
    cause: r.cause, fix: r.fix,
    roast: r.roast[seed % r.roast.length],
    location: loc,
    also: hits.slice(1, 3).map(h => h.name),
  };
}

module.exports = { debugError, looksLikeError, RULES };
