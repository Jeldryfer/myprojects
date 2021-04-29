
(function(l, r) { if (l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (window.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(window.document);
var app = (function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = on_mount.map(run).filter(is_function);
                if (on_destroy) {
                    on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : options.context || []),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.37.0' }, detail)));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    /* src/components/header/index.svelte generated by Svelte v3.37.0 */

    const file$8 = "src/components/header/index.svelte";

    function create_fragment$9(ctx) {
    	let div2;
    	let div1;
    	let div0;
    	let header;
    	let a0;
    	let strong;
    	let t1;
    	let t2;
    	let ul;
    	let li0;
    	let a1;
    	let span0;
    	let t4;
    	let li1;
    	let a2;
    	let span1;
    	let t6;
    	let li2;
    	let a3;
    	let span2;
    	let t8;
    	let li3;
    	let a4;
    	let span3;
    	let t10;
    	let li4;
    	let a5;
    	let span4;

    	const block = {
    		c: function create() {
    			div2 = element("div");
    			div1 = element("div");
    			div0 = element("div");
    			header = element("header");
    			a0 = element("a");
    			strong = element("strong");
    			strong.textContent = "Editorial";
    			t1 = text(" by HTML5 UP");
    			t2 = space();
    			ul = element("ul");
    			li0 = element("li");
    			a1 = element("a");
    			span0 = element("span");
    			span0.textContent = "Twitter";
    			t4 = space();
    			li1 = element("li");
    			a2 = element("a");
    			span1 = element("span");
    			span1.textContent = "Facebook";
    			t6 = space();
    			li2 = element("li");
    			a3 = element("a");
    			span2 = element("span");
    			span2.textContent = "Snapchat";
    			t8 = space();
    			li3 = element("li");
    			a4 = element("a");
    			span3 = element("span");
    			span3.textContent = "Instagram";
    			t10 = space();
    			li4 = element("li");
    			a5 = element("a");
    			span4 = element("span");
    			span4.textContent = "Medium";
    			attr_dev(strong, "class", "svelte-bctt7e");
    			add_location(strong, file$8, 8, 11, 196);
    			attr_dev(a0, "href", "index.html");
    			attr_dev(a0, "class", "logo svelte-bctt7e");
    			add_location(a0, file$8, 7, 8, 151);
    			attr_dev(span0, "class", "label svelte-bctt7e");
    			add_location(span0, file$8, 13, 15, 360);
    			attr_dev(a1, "href", "#");
    			attr_dev(a1, "class", "icon brands fa-twitter svelte-bctt7e");
    			add_location(a1, file$8, 12, 12, 302);
    			attr_dev(li0, "class", "svelte-bctt7e");
    			add_location(li0, file$8, 11, 10, 285);
    			attr_dev(span1, "class", "label svelte-bctt7e");
    			add_location(span1, file$8, 18, 15, 516);
    			attr_dev(a2, "href", "#");
    			attr_dev(a2, "class", "icon brands fa-facebook-f svelte-bctt7e");
    			add_location(a2, file$8, 17, 12, 455);
    			attr_dev(li1, "class", "svelte-bctt7e");
    			add_location(li1, file$8, 16, 10, 438);
    			attr_dev(span2, "class", "label svelte-bctt7e");
    			add_location(span2, file$8, 23, 15, 677);
    			attr_dev(a3, "href", "#");
    			attr_dev(a3, "class", "icon brands fa-snapchat-ghost svelte-bctt7e");
    			add_location(a3, file$8, 22, 12, 612);
    			attr_dev(li2, "class", "svelte-bctt7e");
    			add_location(li2, file$8, 21, 10, 595);
    			attr_dev(span3, "class", "label svelte-bctt7e");
    			add_location(span3, file$8, 28, 15, 833);
    			attr_dev(a4, "href", "#");
    			attr_dev(a4, "class", "icon brands fa-instagram svelte-bctt7e");
    			add_location(a4, file$8, 27, 12, 773);
    			attr_dev(li3, "class", "svelte-bctt7e");
    			add_location(li3, file$8, 26, 10, 756);
    			attr_dev(span4, "class", "label svelte-bctt7e");
    			add_location(span4, file$8, 33, 15, 989);
    			attr_dev(a5, "href", "#");
    			attr_dev(a5, "class", "icon brands fa-medium-m svelte-bctt7e");
    			add_location(a5, file$8, 32, 12, 930);
    			attr_dev(li4, "class", "svelte-bctt7e");
    			add_location(li4, file$8, 31, 10, 913);
    			attr_dev(ul, "class", "icons svelte-bctt7e");
    			add_location(ul, file$8, 10, 8, 256);
    			attr_dev(header, "id", "header");
    			attr_dev(header, "class", "svelte-bctt7e");
    			add_location(header, file$8, 6, 6, 122);
    			attr_dev(div0, "class", "inner svelte-bctt7e");
    			add_location(div0, file$8, 4, 4, 74);
    			attr_dev(div1, "id", "main");
    			attr_dev(div1, "class", "svelte-bctt7e");
    			add_location(div1, file$8, 3, 2, 54);
    			attr_dev(div2, "id", "wrapper");
    			attr_dev(div2, "class", "svelte-bctt7e");
    			add_location(div2, file$8, 1, 0, 17);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div2, anchor);
    			append_dev(div2, div1);
    			append_dev(div1, div0);
    			append_dev(div0, header);
    			append_dev(header, a0);
    			append_dev(a0, strong);
    			append_dev(a0, t1);
    			append_dev(header, t2);
    			append_dev(header, ul);
    			append_dev(ul, li0);
    			append_dev(li0, a1);
    			append_dev(a1, span0);
    			append_dev(ul, t4);
    			append_dev(ul, li1);
    			append_dev(li1, a2);
    			append_dev(a2, span1);
    			append_dev(ul, t6);
    			append_dev(ul, li2);
    			append_dev(li2, a3);
    			append_dev(a3, span2);
    			append_dev(ul, t8);
    			append_dev(ul, li3);
    			append_dev(li3, a4);
    			append_dev(a4, span3);
    			append_dev(ul, t10);
    			append_dev(ul, li4);
    			append_dev(li4, a5);
    			append_dev(a5, span4);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div2);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$9.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$9($$self, $$props) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Header", slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Header> was created with unknown prop '${key}'`);
    	});

    	return [];
    }

    class Header extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$9, create_fragment$9, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Header",
    			options,
    			id: create_fragment$9.name
    		});
    	}
    }

    /* src/components/banner/index.svelte generated by Svelte v3.37.0 */

    const file$7 = "src/components/banner/index.svelte";

    function create_fragment$8(ctx) {
    	let section;
    	let div;
    	let header;
    	let h1;
    	let t0;
    	let br;
    	let t1;
    	let t2;
    	let p0;
    	let t4;
    	let p1;
    	let t6;
    	let ul;
    	let li;
    	let a;
    	let t8;
    	let span;
    	let img;
    	let img_src_value;

    	const block = {
    		c: function create() {
    			section = element("section");
    			div = element("div");
    			header = element("header");
    			h1 = element("h1");
    			t0 = text("Hi, I’m Editorial");
    			br = element("br");
    			t1 = text("\n        by HTML5 UP");
    			t2 = space();
    			p0 = element("p");
    			p0.textContent = "A free and fully responsive site template";
    			t4 = space();
    			p1 = element("p");
    			p1.textContent = "Aenean ornare velit lacus, ac varius enim ullamcorper eu. Proin aliquam\n      facilisis ante interdum congue. Integer mollis, nisl amet convallis,\n      porttitor magna ullamcorper, amet egestas mauris. Ut magna finibus nisi\n      nec lacinia. Nam maximus erat id euismod egestas. Pellentesque sapien ac\n      quam. Lorem ipsum dolor sit nullam.";
    			t6 = space();
    			ul = element("ul");
    			li = element("li");
    			a = element("a");
    			a.textContent = "Learn More";
    			t8 = space();
    			span = element("span");
    			img = element("img");
    			attr_dev(br, "class", "svelte-1grlnai");
    			add_location(br, file$7, 4, 25, 95);
    			attr_dev(h1, "class", "svelte-1grlnai");
    			add_location(h1, file$7, 3, 6, 65);
    			attr_dev(p0, "class", "svelte-1grlnai");
    			add_location(p0, file$7, 7, 6, 140);
    			attr_dev(header, "class", "svelte-1grlnai");
    			add_location(header, file$7, 2, 4, 50);
    			attr_dev(p1, "class", "svelte-1grlnai");
    			add_location(p1, file$7, 9, 4, 207);
    			attr_dev(a, "href", "#");
    			attr_dev(a, "class", "button big svelte-1grlnai");
    			add_location(a, file$7, 17, 10, 607);
    			attr_dev(li, "class", "svelte-1grlnai");
    			add_location(li, file$7, 17, 6, 603);
    			attr_dev(ul, "class", "actions svelte-1grlnai");
    			add_location(ul, file$7, 16, 4, 576);
    			attr_dev(div, "class", "content svelte-1grlnai");
    			add_location(div, file$7, 1, 2, 24);
    			if (img.src !== (img_src_value = "images/pic10.jpg")) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "");
    			attr_dev(img, "class", "svelte-1grlnai");
    			add_location(img, file$7, 21, 4, 711);
    			attr_dev(span, "class", "image object svelte-1grlnai");
    			add_location(span, file$7, 20, 2, 679);
    			attr_dev(section, "id", "banner");
    			attr_dev(section, "class", "svelte-1grlnai");
    			add_location(section, file$7, 0, 0, 0);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, section, anchor);
    			append_dev(section, div);
    			append_dev(div, header);
    			append_dev(header, h1);
    			append_dev(h1, t0);
    			append_dev(h1, br);
    			append_dev(h1, t1);
    			append_dev(header, t2);
    			append_dev(header, p0);
    			append_dev(div, t4);
    			append_dev(div, p1);
    			append_dev(div, t6);
    			append_dev(div, ul);
    			append_dev(ul, li);
    			append_dev(li, a);
    			append_dev(section, t8);
    			append_dev(section, span);
    			append_dev(span, img);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(section);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$8.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$8($$self, $$props) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Banner", slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Banner> was created with unknown prop '${key}'`);
    	});

    	return [];
    }

    class Banner extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$8, create_fragment$8, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Banner",
    			options,
    			id: create_fragment$8.name
    		});
    	}
    }

    /* src/components/section1/index.svelte generated by Svelte v3.37.0 */

    const file$6 = "src/components/section1/index.svelte";

    function create_fragment$7(ctx) {
    	let section;
    	let header;
    	let h2;
    	let t1;
    	let div4;
    	let article0;
    	let span0;
    	let t2;
    	let div0;
    	let h30;
    	let t4;
    	let p0;
    	let t6;
    	let article1;
    	let span1;
    	let t7;
    	let div1;
    	let h31;
    	let t9;
    	let p1;
    	let t11;
    	let article2;
    	let span2;
    	let t12;
    	let div2;
    	let h32;
    	let t14;
    	let p2;
    	let t16;
    	let article3;
    	let span3;
    	let t17;
    	let div3;
    	let h33;
    	let t19;
    	let p3;

    	const block = {
    		c: function create() {
    			section = element("section");
    			header = element("header");
    			h2 = element("h2");
    			h2.textContent = "Erat lacinia";
    			t1 = space();
    			div4 = element("div");
    			article0 = element("article");
    			span0 = element("span");
    			t2 = space();
    			div0 = element("div");
    			h30 = element("h3");
    			h30.textContent = "Portitor ullamcorper";
    			t4 = space();
    			p0 = element("p");
    			p0.textContent = "Aenean ornare velit lacus, ac varius enim lorem ullamcorper dolore.\n          Proin aliquam facilisis ante interdum. Sed nulla amet lorem feugiat\n          tempus aliquam.";
    			t6 = space();
    			article1 = element("article");
    			span1 = element("span");
    			t7 = space();
    			div1 = element("div");
    			h31 = element("h3");
    			h31.textContent = "Sapien veroeros";
    			t9 = space();
    			p1 = element("p");
    			p1.textContent = "Aenean ornare velit lacus, ac varius enim lorem ullamcorper dolore.\n          Proin aliquam facilisis ante interdum. Sed nulla amet lorem feugiat\n          tempus aliquam.";
    			t11 = space();
    			article2 = element("article");
    			span2 = element("span");
    			t12 = space();
    			div2 = element("div");
    			h32 = element("h3");
    			h32.textContent = "Quam lorem ipsum";
    			t14 = space();
    			p2 = element("p");
    			p2.textContent = "Aenean ornare velit lacus, ac varius enim lorem ullamcorper dolore.\n          Proin aliquam facilisis ante interdum. Sed nulla amet lorem feugiat\n          tempus aliquam.";
    			t16 = space();
    			article3 = element("article");
    			span3 = element("span");
    			t17 = space();
    			div3 = element("div");
    			h33 = element("h3");
    			h33.textContent = "Sed magna finibus";
    			t19 = space();
    			p3 = element("p");
    			p3.textContent = "Aenean ornare velit lacus, ac varius enim lorem ullamcorper dolore.\n          Proin aliquam facilisis ante interdum. Sed nulla amet lorem feugiat\n          tempus aliquam.";
    			attr_dev(h2, "class", "svelte-bctt7e");
    			add_location(h2, file$6, 3, 4, 56);
    			attr_dev(header, "class", "major svelte-bctt7e");
    			add_location(header, file$6, 2, 2, 29);
    			attr_dev(span0, "class", "icon fa-gem svelte-bctt7e");
    			add_location(span0, file$6, 7, 6, 135);
    			attr_dev(h30, "class", "svelte-bctt7e");
    			add_location(h30, file$6, 9, 8, 200);
    			attr_dev(p0, "class", "svelte-bctt7e");
    			add_location(p0, file$6, 10, 8, 238);
    			attr_dev(div0, "class", "content svelte-bctt7e");
    			add_location(div0, file$6, 8, 6, 170);
    			attr_dev(article0, "class", "svelte-bctt7e");
    			add_location(article0, file$6, 6, 4, 119);
    			attr_dev(span1, "class", "icon solid fa-paper-plane svelte-bctt7e");
    			add_location(span1, file$6, 18, 6, 485);
    			attr_dev(h31, "class", "svelte-bctt7e");
    			add_location(h31, file$6, 20, 8, 564);
    			attr_dev(p1, "class", "svelte-bctt7e");
    			add_location(p1, file$6, 21, 8, 597);
    			attr_dev(div1, "class", "content svelte-bctt7e");
    			add_location(div1, file$6, 19, 6, 534);
    			attr_dev(article1, "class", "svelte-bctt7e");
    			add_location(article1, file$6, 17, 4, 469);
    			attr_dev(span2, "class", "icon solid fa-rocket svelte-bctt7e");
    			add_location(span2, file$6, 29, 6, 844);
    			attr_dev(h32, "class", "svelte-bctt7e");
    			add_location(h32, file$6, 31, 8, 918);
    			attr_dev(p2, "class", "svelte-bctt7e");
    			add_location(p2, file$6, 32, 8, 952);
    			attr_dev(div2, "class", "content svelte-bctt7e");
    			add_location(div2, file$6, 30, 6, 888);
    			attr_dev(article2, "class", "svelte-bctt7e");
    			add_location(article2, file$6, 28, 4, 828);
    			attr_dev(span3, "class", "icon solid fa-signal svelte-bctt7e");
    			add_location(span3, file$6, 40, 6, 1199);
    			attr_dev(h33, "class", "svelte-bctt7e");
    			add_location(h33, file$6, 42, 8, 1273);
    			attr_dev(p3, "class", "svelte-bctt7e");
    			add_location(p3, file$6, 43, 8, 1308);
    			attr_dev(div3, "class", "content svelte-bctt7e");
    			add_location(div3, file$6, 41, 6, 1243);
    			attr_dev(article3, "class", "svelte-bctt7e");
    			add_location(article3, file$6, 39, 4, 1183);
    			attr_dev(div4, "class", "features svelte-bctt7e");
    			add_location(div4, file$6, 5, 2, 92);
    			attr_dev(section, "class", "svelte-bctt7e");
    			add_location(section, file$6, 1, 0, 17);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, section, anchor);
    			append_dev(section, header);
    			append_dev(header, h2);
    			append_dev(section, t1);
    			append_dev(section, div4);
    			append_dev(div4, article0);
    			append_dev(article0, span0);
    			append_dev(article0, t2);
    			append_dev(article0, div0);
    			append_dev(div0, h30);
    			append_dev(div0, t4);
    			append_dev(div0, p0);
    			append_dev(div4, t6);
    			append_dev(div4, article1);
    			append_dev(article1, span1);
    			append_dev(article1, t7);
    			append_dev(article1, div1);
    			append_dev(div1, h31);
    			append_dev(div1, t9);
    			append_dev(div1, p1);
    			append_dev(div4, t11);
    			append_dev(div4, article2);
    			append_dev(article2, span2);
    			append_dev(article2, t12);
    			append_dev(article2, div2);
    			append_dev(div2, h32);
    			append_dev(div2, t14);
    			append_dev(div2, p2);
    			append_dev(div4, t16);
    			append_dev(div4, article3);
    			append_dev(article3, span3);
    			append_dev(article3, t17);
    			append_dev(article3, div3);
    			append_dev(div3, h33);
    			append_dev(div3, t19);
    			append_dev(div3, p3);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(section);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$7.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$7($$self, $$props) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Section1", slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Section1> was created with unknown prop '${key}'`);
    	});

    	return [];
    }

    class Section1 extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$7, create_fragment$7, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Section1",
    			options,
    			id: create_fragment$7.name
    		});
    	}
    }

    /* src/components/section2/index.svelte generated by Svelte v3.37.0 */

    const file$5 = "src/components/section2/index.svelte";

    function create_fragment$6(ctx) {
    	let section;
    	let header;
    	let h2;
    	let t1;
    	let div;
    	let article0;
    	let a0;
    	let img0;
    	let img0_src_value;
    	let t2;
    	let h30;
    	let t4;
    	let p0;
    	let t6;
    	let ul0;
    	let li0;
    	let a1;
    	let t8;
    	let article1;
    	let a2;
    	let img1;
    	let img1_src_value;
    	let t9;
    	let h31;
    	let t11;
    	let p1;
    	let t13;
    	let ul1;
    	let li1;
    	let a3;
    	let t15;
    	let article2;
    	let a4;
    	let img2;
    	let img2_src_value;
    	let t16;
    	let h32;
    	let t18;
    	let p2;
    	let t20;
    	let ul2;
    	let li2;
    	let a5;
    	let t22;
    	let article3;
    	let a6;
    	let img3;
    	let img3_src_value;
    	let t23;
    	let h33;
    	let t25;
    	let p3;
    	let t27;
    	let ul3;
    	let li3;
    	let a7;
    	let t29;
    	let article4;
    	let a8;
    	let img4;
    	let img4_src_value;
    	let t30;
    	let h34;
    	let t32;
    	let p4;
    	let t34;
    	let ul4;
    	let li4;
    	let a9;
    	let t36;
    	let article5;
    	let a10;
    	let img5;
    	let img5_src_value;
    	let t37;
    	let h35;
    	let t39;
    	let p5;
    	let t41;
    	let ul5;
    	let li5;
    	let a11;

    	const block = {
    		c: function create() {
    			section = element("section");
    			header = element("header");
    			h2 = element("h2");
    			h2.textContent = "Ipsum sed dolor";
    			t1 = space();
    			div = element("div");
    			article0 = element("article");
    			a0 = element("a");
    			img0 = element("img");
    			t2 = space();
    			h30 = element("h3");
    			h30.textContent = "Interdum aenean";
    			t4 = space();
    			p0 = element("p");
    			p0.textContent = "Aenean ornare velit lacus, ac varius enim lorem ullamcorper dolore.\n        Proin aliquam facilisis ante interdum. Sed nulla amet lorem feugiat\n        tempus aliquam.";
    			t6 = space();
    			ul0 = element("ul");
    			li0 = element("li");
    			a1 = element("a");
    			a1.textContent = "More";
    			t8 = space();
    			article1 = element("article");
    			a2 = element("a");
    			img1 = element("img");
    			t9 = space();
    			h31 = element("h3");
    			h31.textContent = "Nulla amet dolore";
    			t11 = space();
    			p1 = element("p");
    			p1.textContent = "Aenean ornare velit lacus, ac varius enim lorem ullamcorper dolore.\n        Proin aliquam facilisis ante interdum. Sed nulla amet lorem feugiat\n        tempus aliquam.";
    			t13 = space();
    			ul1 = element("ul");
    			li1 = element("li");
    			a3 = element("a");
    			a3.textContent = "More";
    			t15 = space();
    			article2 = element("article");
    			a4 = element("a");
    			img2 = element("img");
    			t16 = space();
    			h32 = element("h3");
    			h32.textContent = "Tempus ullamcorper";
    			t18 = space();
    			p2 = element("p");
    			p2.textContent = "Aenean ornare velit lacus, ac varius enim lorem ullamcorper dolore.\n        Proin aliquam facilisis ante interdum. Sed nulla amet lorem feugiat\n        tempus aliquam.";
    			t20 = space();
    			ul2 = element("ul");
    			li2 = element("li");
    			a5 = element("a");
    			a5.textContent = "More";
    			t22 = space();
    			article3 = element("article");
    			a6 = element("a");
    			img3 = element("img");
    			t23 = space();
    			h33 = element("h3");
    			h33.textContent = "Sed etiam facilis";
    			t25 = space();
    			p3 = element("p");
    			p3.textContent = "Aenean ornare velit lacus, ac varius enim lorem ullamcorper dolore.\n        Proin aliquam facilisis ante interdum. Sed nulla amet lorem feugiat\n        tempus aliquam.";
    			t27 = space();
    			ul3 = element("ul");
    			li3 = element("li");
    			a7 = element("a");
    			a7.textContent = "More";
    			t29 = space();
    			article4 = element("article");
    			a8 = element("a");
    			img4 = element("img");
    			t30 = space();
    			h34 = element("h3");
    			h34.textContent = "Feugiat lorem aenean";
    			t32 = space();
    			p4 = element("p");
    			p4.textContent = "Aenean ornare velit lacus, ac varius enim lorem ullamcorper dolore.\n        Proin aliquam facilisis ante interdum. Sed nulla amet lorem feugiat\n        tempus aliquam.";
    			t34 = space();
    			ul4 = element("ul");
    			li4 = element("li");
    			a9 = element("a");
    			a9.textContent = "More";
    			t36 = space();
    			article5 = element("article");
    			a10 = element("a");
    			img5 = element("img");
    			t37 = space();
    			h35 = element("h3");
    			h35.textContent = "Amet varius aliquam";
    			t39 = space();
    			p5 = element("p");
    			p5.textContent = "Aenean ornare velit lacus, ac varius enim lorem ullamcorper dolore.\n        Proin aliquam facilisis ante interdum. Sed nulla amet lorem feugiat\n        tempus aliquam.";
    			t41 = space();
    			ul5 = element("ul");
    			li5 = element("li");
    			a11 = element("a");
    			a11.textContent = "More";
    			attr_dev(h2, "class", "svelte-1tuxe4q");
    			add_location(h2, file$5, 3, 4, 56);
    			attr_dev(header, "class", "major svelte-1tuxe4q");
    			add_location(header, file$5, 2, 2, 29);
    			if (img0.src !== (img0_src_value = "images/pic01.jpg")) attr_dev(img0, "src", img0_src_value);
    			attr_dev(img0, "alt", "");
    			attr_dev(img0, "class", "svelte-1tuxe4q");
    			add_location(img0, file$5, 7, 32, 161);
    			attr_dev(a0, "href", "#");
    			attr_dev(a0, "class", "image svelte-1tuxe4q");
    			add_location(a0, file$5, 7, 6, 135);
    			attr_dev(h30, "class", "svelte-1tuxe4q");
    			add_location(h30, file$5, 8, 6, 209);
    			attr_dev(p0, "class", "svelte-1tuxe4q");
    			add_location(p0, file$5, 9, 6, 240);
    			attr_dev(a1, "href", "#");
    			attr_dev(a1, "class", "button svelte-1tuxe4q");
    			add_location(a1, file$5, 15, 12, 470);
    			attr_dev(li0, "class", "svelte-1tuxe4q");
    			add_location(li0, file$5, 15, 8, 466);
    			attr_dev(ul0, "class", "actions svelte-1tuxe4q");
    			add_location(ul0, file$5, 14, 6, 437);
    			attr_dev(article0, "class", "svelte-1tuxe4q");
    			add_location(article0, file$5, 6, 4, 119);
    			if (img1.src !== (img1_src_value = "images/pic02.jpg")) attr_dev(img1, "src", img1_src_value);
    			attr_dev(img1, "alt", "");
    			attr_dev(img1, "class", "svelte-1tuxe4q");
    			add_location(img1, file$5, 19, 32, 584);
    			attr_dev(a2, "href", "#");
    			attr_dev(a2, "class", "image svelte-1tuxe4q");
    			add_location(a2, file$5, 19, 6, 558);
    			attr_dev(h31, "class", "svelte-1tuxe4q");
    			add_location(h31, file$5, 20, 6, 632);
    			attr_dev(p1, "class", "svelte-1tuxe4q");
    			add_location(p1, file$5, 21, 6, 665);
    			attr_dev(a3, "href", "#");
    			attr_dev(a3, "class", "button svelte-1tuxe4q");
    			add_location(a3, file$5, 27, 12, 895);
    			attr_dev(li1, "class", "svelte-1tuxe4q");
    			add_location(li1, file$5, 27, 8, 891);
    			attr_dev(ul1, "class", "actions svelte-1tuxe4q");
    			add_location(ul1, file$5, 26, 6, 862);
    			attr_dev(article1, "class", "svelte-1tuxe4q");
    			add_location(article1, file$5, 18, 4, 542);
    			if (img2.src !== (img2_src_value = "images/pic03.jpg")) attr_dev(img2, "src", img2_src_value);
    			attr_dev(img2, "alt", "");
    			attr_dev(img2, "class", "svelte-1tuxe4q");
    			add_location(img2, file$5, 31, 32, 1009);
    			attr_dev(a4, "href", "#");
    			attr_dev(a4, "class", "image svelte-1tuxe4q");
    			add_location(a4, file$5, 31, 6, 983);
    			attr_dev(h32, "class", "svelte-1tuxe4q");
    			add_location(h32, file$5, 32, 6, 1057);
    			attr_dev(p2, "class", "svelte-1tuxe4q");
    			add_location(p2, file$5, 33, 6, 1091);
    			attr_dev(a5, "href", "#");
    			attr_dev(a5, "class", "button svelte-1tuxe4q");
    			add_location(a5, file$5, 39, 12, 1321);
    			attr_dev(li2, "class", "svelte-1tuxe4q");
    			add_location(li2, file$5, 39, 8, 1317);
    			attr_dev(ul2, "class", "actions svelte-1tuxe4q");
    			add_location(ul2, file$5, 38, 6, 1288);
    			attr_dev(article2, "class", "svelte-1tuxe4q");
    			add_location(article2, file$5, 30, 4, 967);
    			if (img3.src !== (img3_src_value = "images/pic04.jpg")) attr_dev(img3, "src", img3_src_value);
    			attr_dev(img3, "alt", "");
    			attr_dev(img3, "class", "svelte-1tuxe4q");
    			add_location(img3, file$5, 43, 32, 1435);
    			attr_dev(a6, "href", "#");
    			attr_dev(a6, "class", "image svelte-1tuxe4q");
    			add_location(a6, file$5, 43, 6, 1409);
    			attr_dev(h33, "class", "svelte-1tuxe4q");
    			add_location(h33, file$5, 44, 6, 1483);
    			attr_dev(p3, "class", "svelte-1tuxe4q");
    			add_location(p3, file$5, 45, 6, 1516);
    			attr_dev(a7, "href", "#");
    			attr_dev(a7, "class", "button svelte-1tuxe4q");
    			add_location(a7, file$5, 51, 12, 1746);
    			attr_dev(li3, "class", "svelte-1tuxe4q");
    			add_location(li3, file$5, 51, 8, 1742);
    			attr_dev(ul3, "class", "actions svelte-1tuxe4q");
    			add_location(ul3, file$5, 50, 6, 1713);
    			attr_dev(article3, "class", "svelte-1tuxe4q");
    			add_location(article3, file$5, 42, 4, 1393);
    			if (img4.src !== (img4_src_value = "images/pic05.jpg")) attr_dev(img4, "src", img4_src_value);
    			attr_dev(img4, "alt", "");
    			attr_dev(img4, "class", "svelte-1tuxe4q");
    			add_location(img4, file$5, 55, 32, 1860);
    			attr_dev(a8, "href", "#");
    			attr_dev(a8, "class", "image svelte-1tuxe4q");
    			add_location(a8, file$5, 55, 6, 1834);
    			attr_dev(h34, "class", "svelte-1tuxe4q");
    			add_location(h34, file$5, 56, 6, 1908);
    			attr_dev(p4, "class", "svelte-1tuxe4q");
    			add_location(p4, file$5, 57, 6, 1944);
    			attr_dev(a9, "href", "#");
    			attr_dev(a9, "class", "button svelte-1tuxe4q");
    			add_location(a9, file$5, 63, 12, 2174);
    			attr_dev(li4, "class", "svelte-1tuxe4q");
    			add_location(li4, file$5, 63, 8, 2170);
    			attr_dev(ul4, "class", "actions svelte-1tuxe4q");
    			add_location(ul4, file$5, 62, 6, 2141);
    			attr_dev(article4, "class", "svelte-1tuxe4q");
    			add_location(article4, file$5, 54, 4, 1818);
    			if (img5.src !== (img5_src_value = "images/pic06.jpg")) attr_dev(img5, "src", img5_src_value);
    			attr_dev(img5, "alt", "");
    			attr_dev(img5, "class", "svelte-1tuxe4q");
    			add_location(img5, file$5, 67, 32, 2288);
    			attr_dev(a10, "href", "#");
    			attr_dev(a10, "class", "image svelte-1tuxe4q");
    			add_location(a10, file$5, 67, 6, 2262);
    			attr_dev(h35, "class", "svelte-1tuxe4q");
    			add_location(h35, file$5, 68, 6, 2336);
    			attr_dev(p5, "class", "svelte-1tuxe4q");
    			add_location(p5, file$5, 69, 6, 2371);
    			attr_dev(a11, "href", "#");
    			attr_dev(a11, "class", "button svelte-1tuxe4q");
    			add_location(a11, file$5, 75, 12, 2601);
    			attr_dev(li5, "class", "svelte-1tuxe4q");
    			add_location(li5, file$5, 75, 8, 2597);
    			attr_dev(ul5, "class", "actions svelte-1tuxe4q");
    			add_location(ul5, file$5, 74, 6, 2568);
    			attr_dev(article5, "class", "svelte-1tuxe4q");
    			add_location(article5, file$5, 66, 4, 2246);
    			attr_dev(div, "class", "posts svelte-1tuxe4q");
    			add_location(div, file$5, 5, 2, 95);
    			attr_dev(section, "class", "svelte-1tuxe4q");
    			add_location(section, file$5, 1, 0, 17);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, section, anchor);
    			append_dev(section, header);
    			append_dev(header, h2);
    			append_dev(section, t1);
    			append_dev(section, div);
    			append_dev(div, article0);
    			append_dev(article0, a0);
    			append_dev(a0, img0);
    			append_dev(article0, t2);
    			append_dev(article0, h30);
    			append_dev(article0, t4);
    			append_dev(article0, p0);
    			append_dev(article0, t6);
    			append_dev(article0, ul0);
    			append_dev(ul0, li0);
    			append_dev(li0, a1);
    			append_dev(div, t8);
    			append_dev(div, article1);
    			append_dev(article1, a2);
    			append_dev(a2, img1);
    			append_dev(article1, t9);
    			append_dev(article1, h31);
    			append_dev(article1, t11);
    			append_dev(article1, p1);
    			append_dev(article1, t13);
    			append_dev(article1, ul1);
    			append_dev(ul1, li1);
    			append_dev(li1, a3);
    			append_dev(div, t15);
    			append_dev(div, article2);
    			append_dev(article2, a4);
    			append_dev(a4, img2);
    			append_dev(article2, t16);
    			append_dev(article2, h32);
    			append_dev(article2, t18);
    			append_dev(article2, p2);
    			append_dev(article2, t20);
    			append_dev(article2, ul2);
    			append_dev(ul2, li2);
    			append_dev(li2, a5);
    			append_dev(div, t22);
    			append_dev(div, article3);
    			append_dev(article3, a6);
    			append_dev(a6, img3);
    			append_dev(article3, t23);
    			append_dev(article3, h33);
    			append_dev(article3, t25);
    			append_dev(article3, p3);
    			append_dev(article3, t27);
    			append_dev(article3, ul3);
    			append_dev(ul3, li3);
    			append_dev(li3, a7);
    			append_dev(div, t29);
    			append_dev(div, article4);
    			append_dev(article4, a8);
    			append_dev(a8, img4);
    			append_dev(article4, t30);
    			append_dev(article4, h34);
    			append_dev(article4, t32);
    			append_dev(article4, p4);
    			append_dev(article4, t34);
    			append_dev(article4, ul4);
    			append_dev(ul4, li4);
    			append_dev(li4, a9);
    			append_dev(div, t36);
    			append_dev(div, article5);
    			append_dev(article5, a10);
    			append_dev(a10, img5);
    			append_dev(article5, t37);
    			append_dev(article5, h35);
    			append_dev(article5, t39);
    			append_dev(article5, p5);
    			append_dev(article5, t41);
    			append_dev(article5, ul5);
    			append_dev(ul5, li5);
    			append_dev(li5, a11);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(section);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$6.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$6($$self, $$props) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Section2", slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Section2> was created with unknown prop '${key}'`);
    	});

    	return [];
    }

    class Section2 extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$6, create_fragment$6, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Section2",
    			options,
    			id: create_fragment$6.name
    		});
    	}
    }

    /* src/components/section3/index.svelte generated by Svelte v3.37.0 */

    const file$4 = "src/components/section3/index.svelte";

    function create_fragment$5(ctx) {
    	let section;
    	let header;
    	let h2;
    	let t1;
    	let div;
    	let article0;
    	let a0;
    	let img0;
    	let img0_src_value;
    	let t2;
    	let p0;
    	let t4;
    	let article1;
    	let a1;
    	let img1;
    	let img1_src_value;
    	let t5;
    	let p1;
    	let t7;
    	let article2;
    	let a2;
    	let img2;
    	let img2_src_value;
    	let t8;
    	let p2;
    	let t10;
    	let ul;
    	let li;
    	let a3;

    	const block = {
    		c: function create() {
    			section = element("section");
    			header = element("header");
    			h2 = element("h2");
    			h2.textContent = "Ante interdum";
    			t1 = space();
    			div = element("div");
    			article0 = element("article");
    			a0 = element("a");
    			img0 = element("img");
    			t2 = space();
    			p0 = element("p");
    			p0.textContent = "Aenean ornare velit lacus, ac varius enim lorem ullamcorper dolore\n        aliquam.";
    			t4 = space();
    			article1 = element("article");
    			a1 = element("a");
    			img1 = element("img");
    			t5 = space();
    			p1 = element("p");
    			p1.textContent = "Aenean ornare velit lacus, ac varius enim lorem ullamcorper dolore\n        aliquam.";
    			t7 = space();
    			article2 = element("article");
    			a2 = element("a");
    			img2 = element("img");
    			t8 = space();
    			p2 = element("p");
    			p2.textContent = "Aenean ornare velit lacus, ac varius enim lorem ullamcorper dolore\n        aliquam.";
    			t10 = space();
    			ul = element("ul");
    			li = element("li");
    			a3 = element("a");
    			a3.textContent = "More";
    			attr_dev(h2, "class", "svelte-bctt7e");
    			add_location(h2, file$4, 3, 4, 56);
    			attr_dev(header, "class", "major svelte-bctt7e");
    			add_location(header, file$4, 2, 2, 29);
    			if (img0.src !== (img0_src_value = "images/pic07.jpg")) attr_dev(img0, "src", img0_src_value);
    			attr_dev(img0, "alt", "");
    			attr_dev(img0, "class", "svelte-bctt7e");
    			add_location(img0, file$4, 7, 32, 164);
    			attr_dev(a0, "href", "#");
    			attr_dev(a0, "class", "image svelte-bctt7e");
    			add_location(a0, file$4, 7, 6, 138);
    			attr_dev(p0, "class", "svelte-bctt7e");
    			add_location(p0, file$4, 8, 6, 212);
    			attr_dev(article0, "class", "svelte-bctt7e");
    			add_location(article0, file$4, 6, 4, 122);
    			if (img1.src !== (img1_src_value = "images/pic08.jpg")) attr_dev(img1, "src", img1_src_value);
    			attr_dev(img1, "alt", "");
    			attr_dev(img1, "class", "svelte-bctt7e");
    			add_location(img1, file$4, 14, 32, 380);
    			attr_dev(a1, "href", "#");
    			attr_dev(a1, "class", "image svelte-bctt7e");
    			add_location(a1, file$4, 14, 6, 354);
    			attr_dev(p1, "class", "svelte-bctt7e");
    			add_location(p1, file$4, 15, 6, 428);
    			attr_dev(article1, "class", "svelte-bctt7e");
    			add_location(article1, file$4, 13, 4, 338);
    			if (img2.src !== (img2_src_value = "images/pic09.jpg")) attr_dev(img2, "src", img2_src_value);
    			attr_dev(img2, "alt", "");
    			attr_dev(img2, "class", "svelte-bctt7e");
    			add_location(img2, file$4, 21, 32, 596);
    			attr_dev(a2, "href", "#");
    			attr_dev(a2, "class", "image svelte-bctt7e");
    			add_location(a2, file$4, 21, 6, 570);
    			attr_dev(p2, "class", "svelte-bctt7e");
    			add_location(p2, file$4, 22, 6, 644);
    			attr_dev(article2, "class", "svelte-bctt7e");
    			add_location(article2, file$4, 20, 4, 554);
    			attr_dev(div, "class", "mini-posts svelte-bctt7e");
    			add_location(div, file$4, 5, 2, 93);
    			attr_dev(a3, "href", "#");
    			attr_dev(a3, "class", "button svelte-bctt7e");
    			add_location(a3, file$4, 29, 8, 806);
    			attr_dev(li, "class", "svelte-bctt7e");
    			add_location(li, file$4, 29, 4, 802);
    			attr_dev(ul, "class", "actions svelte-bctt7e");
    			add_location(ul, file$4, 28, 2, 777);
    			attr_dev(section, "class", "svelte-bctt7e");
    			add_location(section, file$4, 1, 0, 17);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, section, anchor);
    			append_dev(section, header);
    			append_dev(header, h2);
    			append_dev(section, t1);
    			append_dev(section, div);
    			append_dev(div, article0);
    			append_dev(article0, a0);
    			append_dev(a0, img0);
    			append_dev(article0, t2);
    			append_dev(article0, p0);
    			append_dev(div, t4);
    			append_dev(div, article1);
    			append_dev(article1, a1);
    			append_dev(a1, img1);
    			append_dev(article1, t5);
    			append_dev(article1, p1);
    			append_dev(div, t7);
    			append_dev(div, article2);
    			append_dev(article2, a2);
    			append_dev(a2, img2);
    			append_dev(article2, t8);
    			append_dev(article2, p2);
    			append_dev(section, t10);
    			append_dev(section, ul);
    			append_dev(ul, li);
    			append_dev(li, a3);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(section);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$5.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$5($$self, $$props) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Section3", slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Section3> was created with unknown prop '${key}'`);
    	});

    	return [];
    }

    class Section3 extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$5, create_fragment$5, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Section3",
    			options,
    			id: create_fragment$5.name
    		});
    	}
    }

    /* src/components/section4/index.svelte generated by Svelte v3.37.0 */

    const file$3 = "src/components/section4/index.svelte";

    function create_fragment$4(ctx) {
    	let section;
    	let header;
    	let h2;
    	let t1;
    	let p;
    	let t3;
    	let ul;
    	let li0;
    	let a;
    	let t5;
    	let li1;
    	let t7;
    	let li2;
    	let t8;
    	let br;
    	let t9;

    	const block = {
    		c: function create() {
    			section = element("section");
    			header = element("header");
    			h2 = element("h2");
    			h2.textContent = "Get in touch";
    			t1 = space();
    			p = element("p");
    			p.textContent = "Sed varius enim lorem ullamcorper dolore aliquam aenean ornare velit lacus,\n    ac varius enim lorem ullamcorper dolore. Proin sed aliquam facilisis ante\n    interdum. Sed nulla amet lorem feugiat tempus aliquam.";
    			t3 = space();
    			ul = element("ul");
    			li0 = element("li");
    			a = element("a");
    			a.textContent = "information@untitled.tld";
    			t5 = space();
    			li1 = element("li");
    			li1.textContent = "(000) 000-0000";
    			t7 = space();
    			li2 = element("li");
    			t8 = text("1234 Somewhere Road #8254");
    			br = element("br");
    			t9 = text("\n      Nashville, TN 00000-0000");
    			attr_dev(h2, "class", "svelte-bctt7e");
    			add_location(h2, file$3, 3, 4, 56);
    			attr_dev(header, "class", "major svelte-bctt7e");
    			add_location(header, file$3, 2, 2, 29);
    			attr_dev(p, "class", "svelte-bctt7e");
    			add_location(p, file$3, 5, 2, 92);
    			attr_dev(a, "href", "#");
    			attr_dev(a, "class", "svelte-bctt7e");
    			add_location(a, file$3, 12, 6, 389);
    			attr_dev(li0, "class", "icon solid fa-envelope svelte-bctt7e");
    			add_location(li0, file$3, 11, 4, 347);
    			attr_dev(li1, "class", "icon solid fa-phone svelte-bctt7e");
    			add_location(li1, file$3, 14, 4, 444);
    			attr_dev(br, "class", "svelte-bctt7e");
    			add_location(br, file$3, 16, 31, 563);
    			attr_dev(li2, "class", "icon solid fa-home svelte-bctt7e");
    			add_location(li2, file$3, 15, 4, 500);
    			attr_dev(ul, "class", "contact svelte-bctt7e");
    			add_location(ul, file$3, 10, 2, 322);
    			attr_dev(section, "class", "svelte-bctt7e");
    			add_location(section, file$3, 1, 0, 17);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, section, anchor);
    			append_dev(section, header);
    			append_dev(header, h2);
    			append_dev(section, t1);
    			append_dev(section, p);
    			append_dev(section, t3);
    			append_dev(section, ul);
    			append_dev(ul, li0);
    			append_dev(li0, a);
    			append_dev(ul, t5);
    			append_dev(ul, li1);
    			append_dev(ul, t7);
    			append_dev(ul, li2);
    			append_dev(li2, t8);
    			append_dev(li2, br);
    			append_dev(li2, t9);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(section);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$4.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$4($$self, $$props) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Section4", slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Section4> was created with unknown prop '${key}'`);
    	});

    	return [];
    }

    class Section4 extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$4, create_fragment$4, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Section4",
    			options,
    			id: create_fragment$4.name
    		});
    	}
    }

    /* src/components/searchinput/index.svelte generated by Svelte v3.37.0 */

    const file$2 = "src/components/searchinput/index.svelte";

    function create_fragment$3(ctx) {
    	let div1;
    	let div0;
    	let section;
    	let form;
    	let input;

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			div0 = element("div");
    			section = element("section");
    			form = element("form");
    			input = element("input");
    			attr_dev(input, "type", "text");
    			attr_dev(input, "name", "query");
    			attr_dev(input, "id", "query");
    			attr_dev(input, "placeholder", "Search");
    			attr_dev(input, "class", "svelte-bctt7e");
    			add_location(input, file$2, 6, 8, 162);
    			attr_dev(form, "method", "post");
    			attr_dev(form, "action", "#");
    			attr_dev(form, "class", "svelte-bctt7e");
    			add_location(form, file$2, 5, 6, 122);
    			attr_dev(section, "id", "search");
    			attr_dev(section, "class", "alt svelte-bctt7e");
    			add_location(section, file$2, 4, 4, 82);
    			attr_dev(div0, "class", "inner svelte-bctt7e");
    			add_location(div0, file$2, 2, 2, 38);
    			attr_dev(div1, "id", "sidebar");
    			attr_dev(div1, "class", "svelte-bctt7e");
    			add_location(div1, file$2, 1, 0, 17);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, div0);
    			append_dev(div0, section);
    			append_dev(section, form);
    			append_dev(form, input);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$3.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$3($$self, $$props) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Searchinput", slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Searchinput> was created with unknown prop '${key}'`);
    	});

    	return [];
    }

    class Searchinput extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Searchinput",
    			options,
    			id: create_fragment$3.name
    		});
    	}
    }

    /* src/components/footer/index.svelte generated by Svelte v3.37.0 */

    const file$1 = "src/components/footer/index.svelte";

    function create_fragment$2(ctx) {
    	let footer;
    	let p;
    	let t0;
    	let a0;
    	let t2;
    	let a1;
    	let t4;

    	const block = {
    		c: function create() {
    			footer = element("footer");
    			p = element("p");
    			t0 = text("© Untitled. All rights reserved. Demo Images: ");
    			a0 = element("a");
    			a0.textContent = "Unsplash";
    			t2 = text(". Design: ");
    			a1 = element("a");
    			a1.textContent = "HTML5 UP";
    			t4 = text(".");
    			attr_dev(a0, "href", "https://unsplash.com");
    			attr_dev(a0, "class", "svelte-1tuxf4s");
    			add_location(a0, file$1, 3, 55, 116);
    			attr_dev(a1, "href", "https://html5up.net");
    			attr_dev(a1, "class", "svelte-1tuxf4s");
    			add_location(a1, file$1, 5, 15, 180);
    			attr_dev(p, "class", "copyright svelte-1tuxf4s");
    			add_location(p, file$1, 2, 2, 39);
    			attr_dev(footer, "id", "footer");
    			attr_dev(footer, "class", "svelte-1tuxf4s");
    			add_location(footer, file$1, 1, 0, 16);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, footer, anchor);
    			append_dev(footer, p);
    			append_dev(p, t0);
    			append_dev(p, a0);
    			append_dev(p, t2);
    			append_dev(p, a1);
    			append_dev(p, t4);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(footer);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$2($$self, $$props) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Footer", slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Footer> was created with unknown prop '${key}'`);
    	});

    	return [];
    }

    class Footer extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Footer",
    			options,
    			id: create_fragment$2.name
    		});
    	}
    }

    /* src/components/menu/index.svelte generated by Svelte v3.37.0 */

    const file = "src/components/menu/index.svelte";

    function create_fragment$1(ctx) {
    	let nav;
    	let header;
    	let h2;
    	let t1;
    	let ul2;
    	let li0;
    	let a0;
    	let t3;
    	let li1;
    	let a1;
    	let t5;
    	let li2;
    	let a2;
    	let t7;
    	let li7;
    	let span0;
    	let t9;
    	let ul0;
    	let li3;
    	let a3;
    	let t11;
    	let li4;
    	let a4;
    	let t13;
    	let li5;
    	let a5;
    	let t15;
    	let li6;
    	let a6;
    	let t17;
    	let li8;
    	let a7;
    	let t19;
    	let li9;
    	let a8;
    	let t21;
    	let li14;
    	let span1;
    	let t23;
    	let ul1;
    	let li10;
    	let a9;
    	let t25;
    	let li11;
    	let a10;
    	let t27;
    	let li12;
    	let a11;
    	let t29;
    	let li13;
    	let a12;
    	let t31;
    	let li15;
    	let a13;
    	let t33;
    	let li16;
    	let a14;
    	let t35;
    	let li17;
    	let a15;

    	const block = {
    		c: function create() {
    			nav = element("nav");
    			header = element("header");
    			h2 = element("h2");
    			h2.textContent = "Menu";
    			t1 = space();
    			ul2 = element("ul");
    			li0 = element("li");
    			a0 = element("a");
    			a0.textContent = "Homepage";
    			t3 = space();
    			li1 = element("li");
    			a1 = element("a");
    			a1.textContent = "Generic";
    			t5 = space();
    			li2 = element("li");
    			a2 = element("a");
    			a2.textContent = "Elements";
    			t7 = space();
    			li7 = element("li");
    			span0 = element("span");
    			span0.textContent = "Submenu";
    			t9 = space();
    			ul0 = element("ul");
    			li3 = element("li");
    			a3 = element("a");
    			a3.textContent = "Lorem Dolor";
    			t11 = space();
    			li4 = element("li");
    			a4 = element("a");
    			a4.textContent = "Ipsum Adipiscing";
    			t13 = space();
    			li5 = element("li");
    			a5 = element("a");
    			a5.textContent = "Tempus Magna";
    			t15 = space();
    			li6 = element("li");
    			a6 = element("a");
    			a6.textContent = "Feugiat Veroeros";
    			t17 = space();
    			li8 = element("li");
    			a7 = element("a");
    			a7.textContent = "Etiam Dolore";
    			t19 = space();
    			li9 = element("li");
    			a8 = element("a");
    			a8.textContent = "Adipiscing";
    			t21 = space();
    			li14 = element("li");
    			span1 = element("span");
    			span1.textContent = "Another Submenu";
    			t23 = space();
    			ul1 = element("ul");
    			li10 = element("li");
    			a9 = element("a");
    			a9.textContent = "Lorem Dolor";
    			t25 = space();
    			li11 = element("li");
    			a10 = element("a");
    			a10.textContent = "Ipsum Adipiscing";
    			t27 = space();
    			li12 = element("li");
    			a11 = element("a");
    			a11.textContent = "Tempus Magna";
    			t29 = space();
    			li13 = element("li");
    			a12 = element("a");
    			a12.textContent = "Feugiat Veroeros";
    			t31 = space();
    			li15 = element("li");
    			a13 = element("a");
    			a13.textContent = "Maximus Erat";
    			t33 = space();
    			li16 = element("li");
    			a14 = element("a");
    			a14.textContent = "Sapien Mauris";
    			t35 = space();
    			li17 = element("li");
    			a15 = element("a");
    			a15.textContent = "Amet Lacinia";
    			attr_dev(h2, "class", "svelte-bctt7e");
    			add_location(h2, file, 3, 4, 59);
    			attr_dev(header, "class", "major svelte-bctt7e");
    			add_location(header, file, 2, 2, 32);
    			attr_dev(a0, "href", "index.html");
    			attr_dev(a0, "class", "svelte-bctt7e");
    			add_location(a0, file, 6, 8, 100);
    			attr_dev(li0, "class", "svelte-bctt7e");
    			add_location(li0, file, 6, 4, 96);
    			attr_dev(a1, "href", "generic.html");
    			attr_dev(a1, "class", "svelte-bctt7e");
    			add_location(a1, file, 7, 8, 147);
    			attr_dev(li1, "class", "svelte-bctt7e");
    			add_location(li1, file, 7, 4, 143);
    			attr_dev(a2, "href", "elements.html");
    			attr_dev(a2, "class", "svelte-bctt7e");
    			add_location(a2, file, 8, 8, 195);
    			attr_dev(li2, "class", "svelte-bctt7e");
    			add_location(li2, file, 8, 4, 191);
    			attr_dev(span0, "class", "opener svelte-bctt7e");
    			add_location(span0, file, 10, 6, 252);
    			attr_dev(a3, "href", "#");
    			attr_dev(a3, "class", "svelte-bctt7e");
    			add_location(a3, file, 12, 12, 311);
    			attr_dev(li3, "class", "svelte-bctt7e");
    			add_location(li3, file, 12, 8, 307);
    			attr_dev(a4, "href", "#");
    			attr_dev(a4, "class", "svelte-bctt7e");
    			add_location(a4, file, 13, 12, 356);
    			attr_dev(li4, "class", "svelte-bctt7e");
    			add_location(li4, file, 13, 8, 352);
    			attr_dev(a5, "href", "#");
    			attr_dev(a5, "class", "svelte-bctt7e");
    			add_location(a5, file, 14, 12, 406);
    			attr_dev(li5, "class", "svelte-bctt7e");
    			add_location(li5, file, 14, 8, 402);
    			attr_dev(a6, "href", "#");
    			attr_dev(a6, "class", "svelte-bctt7e");
    			add_location(a6, file, 15, 12, 452);
    			attr_dev(li6, "class", "svelte-bctt7e");
    			add_location(li6, file, 15, 8, 448);
    			attr_dev(ul0, "class", "svelte-bctt7e");
    			add_location(ul0, file, 11, 6, 294);
    			attr_dev(li7, "class", "svelte-bctt7e");
    			add_location(li7, file, 9, 4, 241);
    			attr_dev(a7, "href", "#");
    			attr_dev(a7, "class", "svelte-bctt7e");
    			add_location(a7, file, 18, 8, 520);
    			attr_dev(li8, "class", "svelte-bctt7e");
    			add_location(li8, file, 18, 4, 516);
    			attr_dev(a8, "href", "#");
    			attr_dev(a8, "class", "svelte-bctt7e");
    			add_location(a8, file, 19, 8, 562);
    			attr_dev(li9, "class", "svelte-bctt7e");
    			add_location(li9, file, 19, 4, 558);
    			attr_dev(span1, "class", "opener svelte-bctt7e");
    			add_location(span1, file, 21, 6, 609);
    			attr_dev(a9, "href", "#");
    			attr_dev(a9, "class", "svelte-bctt7e");
    			add_location(a9, file, 23, 12, 676);
    			attr_dev(li10, "class", "svelte-bctt7e");
    			add_location(li10, file, 23, 8, 672);
    			attr_dev(a10, "href", "#");
    			attr_dev(a10, "class", "svelte-bctt7e");
    			add_location(a10, file, 24, 12, 721);
    			attr_dev(li11, "class", "svelte-bctt7e");
    			add_location(li11, file, 24, 8, 717);
    			attr_dev(a11, "href", "#");
    			attr_dev(a11, "class", "svelte-bctt7e");
    			add_location(a11, file, 25, 12, 771);
    			attr_dev(li12, "class", "svelte-bctt7e");
    			add_location(li12, file, 25, 8, 767);
    			attr_dev(a12, "href", "#");
    			attr_dev(a12, "class", "svelte-bctt7e");
    			add_location(a12, file, 26, 12, 817);
    			attr_dev(li13, "class", "svelte-bctt7e");
    			add_location(li13, file, 26, 8, 813);
    			attr_dev(ul1, "class", "svelte-bctt7e");
    			add_location(ul1, file, 22, 6, 659);
    			attr_dev(li14, "class", "svelte-bctt7e");
    			add_location(li14, file, 20, 4, 598);
    			attr_dev(a13, "href", "#");
    			attr_dev(a13, "class", "svelte-bctt7e");
    			add_location(a13, file, 29, 8, 885);
    			attr_dev(li15, "class", "svelte-bctt7e");
    			add_location(li15, file, 29, 4, 881);
    			attr_dev(a14, "href", "#");
    			attr_dev(a14, "class", "svelte-bctt7e");
    			add_location(a14, file, 30, 8, 927);
    			attr_dev(li16, "class", "svelte-bctt7e");
    			add_location(li16, file, 30, 4, 923);
    			attr_dev(a15, "href", "#");
    			attr_dev(a15, "class", "svelte-bctt7e");
    			add_location(a15, file, 31, 8, 970);
    			attr_dev(li17, "class", "svelte-bctt7e");
    			add_location(li17, file, 31, 4, 966);
    			attr_dev(ul2, "class", "svelte-bctt7e");
    			add_location(ul2, file, 5, 2, 87);
    			attr_dev(nav, "id", "menu");
    			attr_dev(nav, "class", "svelte-bctt7e");
    			add_location(nav, file, 1, 0, 14);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, nav, anchor);
    			append_dev(nav, header);
    			append_dev(header, h2);
    			append_dev(nav, t1);
    			append_dev(nav, ul2);
    			append_dev(ul2, li0);
    			append_dev(li0, a0);
    			append_dev(ul2, t3);
    			append_dev(ul2, li1);
    			append_dev(li1, a1);
    			append_dev(ul2, t5);
    			append_dev(ul2, li2);
    			append_dev(li2, a2);
    			append_dev(ul2, t7);
    			append_dev(ul2, li7);
    			append_dev(li7, span0);
    			append_dev(li7, t9);
    			append_dev(li7, ul0);
    			append_dev(ul0, li3);
    			append_dev(li3, a3);
    			append_dev(ul0, t11);
    			append_dev(ul0, li4);
    			append_dev(li4, a4);
    			append_dev(ul0, t13);
    			append_dev(ul0, li5);
    			append_dev(li5, a5);
    			append_dev(ul0, t15);
    			append_dev(ul0, li6);
    			append_dev(li6, a6);
    			append_dev(ul2, t17);
    			append_dev(ul2, li8);
    			append_dev(li8, a7);
    			append_dev(ul2, t19);
    			append_dev(ul2, li9);
    			append_dev(li9, a8);
    			append_dev(ul2, t21);
    			append_dev(ul2, li14);
    			append_dev(li14, span1);
    			append_dev(li14, t23);
    			append_dev(li14, ul1);
    			append_dev(ul1, li10);
    			append_dev(li10, a9);
    			append_dev(ul1, t25);
    			append_dev(ul1, li11);
    			append_dev(li11, a10);
    			append_dev(ul1, t27);
    			append_dev(ul1, li12);
    			append_dev(li12, a11);
    			append_dev(ul1, t29);
    			append_dev(ul1, li13);
    			append_dev(li13, a12);
    			append_dev(ul2, t31);
    			append_dev(ul2, li15);
    			append_dev(li15, a13);
    			append_dev(ul2, t33);
    			append_dev(ul2, li16);
    			append_dev(li16, a14);
    			append_dev(ul2, t35);
    			append_dev(ul2, li17);
    			append_dev(li17, a15);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(nav);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$1($$self, $$props) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Menu", slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Menu> was created with unknown prop '${key}'`);
    	});

    	return [];
    }

    class Menu extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Menu",
    			options,
    			id: create_fragment$1.name
    		});
    	}
    }

    /* src/App.svelte generated by Svelte v3.37.0 */

    function create_fragment(ctx) {
    	let header;
    	let t0;
    	let banner;
    	let t1;
    	let section;
    	let t2;
    	let section2;
    	let t3;
    	let section3;
    	let t4;
    	let section4;
    	let t5;
    	let input;
    	let t6;
    	let menu;
    	let t7;
    	let footer;
    	let current;
    	header = new Header({ $$inline: true });
    	banner = new Banner({ $$inline: true });
    	section = new Section1({ $$inline: true });
    	section2 = new Section2({ $$inline: true });
    	section3 = new Section3({ $$inline: true });
    	section4 = new Section4({ $$inline: true });
    	input = new Searchinput({ $$inline: true });
    	menu = new Menu({ $$inline: true });
    	footer = new Footer({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(header.$$.fragment);
    			t0 = space();
    			create_component(banner.$$.fragment);
    			t1 = space();
    			create_component(section.$$.fragment);
    			t2 = space();
    			create_component(section2.$$.fragment);
    			t3 = space();
    			create_component(section3.$$.fragment);
    			t4 = space();
    			create_component(section4.$$.fragment);
    			t5 = space();
    			create_component(input.$$.fragment);
    			t6 = space();
    			create_component(menu.$$.fragment);
    			t7 = space();
    			create_component(footer.$$.fragment);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			mount_component(header, target, anchor);
    			insert_dev(target, t0, anchor);
    			mount_component(banner, target, anchor);
    			insert_dev(target, t1, anchor);
    			mount_component(section, target, anchor);
    			insert_dev(target, t2, anchor);
    			mount_component(section2, target, anchor);
    			insert_dev(target, t3, anchor);
    			mount_component(section3, target, anchor);
    			insert_dev(target, t4, anchor);
    			mount_component(section4, target, anchor);
    			insert_dev(target, t5, anchor);
    			mount_component(input, target, anchor);
    			insert_dev(target, t6, anchor);
    			mount_component(menu, target, anchor);
    			insert_dev(target, t7, anchor);
    			mount_component(footer, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(header.$$.fragment, local);
    			transition_in(banner.$$.fragment, local);
    			transition_in(section.$$.fragment, local);
    			transition_in(section2.$$.fragment, local);
    			transition_in(section3.$$.fragment, local);
    			transition_in(section4.$$.fragment, local);
    			transition_in(input.$$.fragment, local);
    			transition_in(menu.$$.fragment, local);
    			transition_in(footer.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(header.$$.fragment, local);
    			transition_out(banner.$$.fragment, local);
    			transition_out(section.$$.fragment, local);
    			transition_out(section2.$$.fragment, local);
    			transition_out(section3.$$.fragment, local);
    			transition_out(section4.$$.fragment, local);
    			transition_out(input.$$.fragment, local);
    			transition_out(menu.$$.fragment, local);
    			transition_out(footer.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(header, detaching);
    			if (detaching) detach_dev(t0);
    			destroy_component(banner, detaching);
    			if (detaching) detach_dev(t1);
    			destroy_component(section, detaching);
    			if (detaching) detach_dev(t2);
    			destroy_component(section2, detaching);
    			if (detaching) detach_dev(t3);
    			destroy_component(section3, detaching);
    			if (detaching) detach_dev(t4);
    			destroy_component(section4, detaching);
    			if (detaching) detach_dev(t5);
    			destroy_component(input, detaching);
    			if (detaching) detach_dev(t6);
    			destroy_component(menu, detaching);
    			if (detaching) detach_dev(t7);
    			destroy_component(footer, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("App", slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({
    		Header,
    		Banner,
    		Section: Section1,
    		Section2,
    		Section3,
    		Section4,
    		Input: Searchinput,
    		Footer,
    		Menu
    	});

    	return [];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    const app = new App({
    	target: document.body,
    	props: {
    		name: 'world'
    	}
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map
