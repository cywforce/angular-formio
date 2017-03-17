import { EventEmitter, Injectable }  from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormioResourceRegistry } from './resource.registry';
import { FormioResourceConfig } from './resource.config';
import { FormioLoader } from '../../index';
let Formio = require('formiojs');
let Promise = require('native-promise-only');

@Injectable()
export class FormioResourceService {
    public form: any;
    public resource: any;
    public resourceUrl: string;
    public formUrl: string;
    public formFormio: any;
    public formio: any;

    public onIndexSelect: EventEmitter<Object>;

    public resourceLoading: Promise<any>;
    public resourceLoaded: Promise<any>;
    public resourceResolve: any;
    public resourceReject: any;

    public formLoading: Promise<any>;
    public formLoaded: Promise<any>;
    public formResolve: any;
    public formReject: any;

    constructor(
        private config: FormioResourceConfig,
        private loader: FormioLoader,
        private registry: FormioResourceRegistry
    ) {
        Formio.setBaseUrl(this.config.app.apiUrl);
        Formio.setAppUrl(this.config.app.appUrl);

        // Add this resource service to the list of all resources in context.
        if (this.registry) {
            this.registry.resources[this.config.name] = this;
        }

        // Create the form url and load the resources.
        this.formUrl = this.config.app.appUrl + '/' + this.config.form;
        this.onIndexSelect = new EventEmitter();
        this.resource = {data: {}};
        this.resourceLoaded = new Promise((resolve: any, reject: any) => {
            this.resourceResolve = resolve;
            this.resourceReject = reject;
        });
        this.formLoaded = new Promise((resolve: any, reject: any) => {
            this.formResolve = resolve;
            this.formReject = reject;
        });
        this.loadForm();
        this.setParents();
    }

    loadForm() {
        if (this.formLoading) {
            return this.formLoading;
        }
        this.formFormio = (new Formio(this.formUrl));
        this.loader.loading = true;
        this.formLoading = this.formFormio.loadForm().then((form: any) => {
            this.form = form;
            this.formResolve(form);
            this.loader.loading = false;
            return form;
        }, (err: any) => this.formReject(err)).catch((err: any) => this.formReject(err));
        return this.formLoading;
    }

    setParents() {
        if (!this.config.parents || !this.config.parents.length) {
            return;
        }

        if (!this.registry) {
            console.warn('You must provide the FormioResourceRegistry within your application to use nested resources.');
            return;
        }

        // Iterate through the list of parents.
        this.config.parents.forEach((parent: string) => {
            // See if this parent is already in context.
            if (this.registry.resources.hasOwnProperty(parent)) {
                this.registry.resources[parent].resourceLoaded.then((resource) => {
                    if (!this.resourceLoading) {
                        // Set the value of this parent in the submission data.
                        this.resource.data[parent] = resource;
                    }
                });
            }
        });
    }

    loadResource(route: ActivatedRoute) {
        if (this.resourceLoading) {
            return this.resourceLoading;
        }
        let id = route.snapshot.params['id'];
        this.resourceUrl = this.config.app.appUrl + '/' + this.config.form;
        this.resourceUrl += '/submission/' + id;
        this.formio = (new Formio(this.resourceUrl));
        this.loader.loading = true;
        this.resourceLoading = this.formio.loadSubmission().then((resource: any) => {
            this.resource = resource;
            this.resourceResolve(resource);
            this.loader.loading = false;
            return resource;
        }, (err: any) => this.resourceReject(err)).catch((err: any) => this.resourceReject(err));
        return this.resourceLoading;
    }

    save(resource:any) {
        let formio = resource._id ? this.formio : this.formFormio;
        this.loader.loading = true;
        return formio.saveSubmission(resource).then((resource: any) => {
            this.resource = resource;
            this.loader.loading = false;
            return resource;
        });
    }

    remove() {
        return this.formio.deleteSubmission().then(() => {
           this.resource = null;
        });
    }
}