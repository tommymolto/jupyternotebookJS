// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.
'use strict';

import {
  IKernel
} from 'jupyter-js-services';

import {
  showDialog
} from 'jupyter-js-ui/lib/dialog';

import {
  IDocumentContext
} from 'jupyter-js-ui/lib/docmanager';

import {
  RenderMime
} from 'jupyter-js-ui/lib/rendermime';

import {
  MimeData as IClipboard
} from 'phosphor-dragdrop';

import {
  Panel, PanelLayout
} from 'phosphor-panel';

import {
  IChangedArgs
} from 'phosphor-properties';

import {
  Widget
} from 'phosphor-widget';

import {
  CellEditorWidget, ITextChange, ICompletionRequest
} from '../cells/editor';

import {
  CompletionWidget, CompletionModel
} from '../completion';

import {
  INotebookModel
} from './model';

import {
  NotebookToolbar
} from './toolbar';

import {
  ActiveNotebook
} from './widget';


/**
 * The class name added to notebook panels.
 */
const NB_PANEL = 'jp-Notebook-panel';

/**
 * The class name added to notebook container widgets.
 */
const NB_CONTAINER = 'jp-Notebook-container';

/**
 * The class name added to a dirty widget.
 */
const DIRTY_CLASS = 'jp-mod-dirty';


/**
 * A widget that hosts a notebook toolbar and content area.
 *
 * #### Notes
 * The widget keeps the document metadata in sync with the current
 * kernel on the context.
 */
export
class NotebookPanel extends Widget {
  /**
   * Create a new content area for the notebook.
   */
  static createContent(model: INotebookModel, rendermime: RenderMime<Widget>): ActiveNotebook {
    return new ActiveNotebook(model, rendermime);
  }

  /**
   * Create a new toolbar for the notebook.
   */
  static createToolbar(): NotebookToolbar {
    return new NotebookToolbar();
  }

  /**
   * Create a new completion widget.
   */
  static createCompletion(): CompletionWidget {
    let model = new CompletionModel();
    return new CompletionWidget(model);
  }

  /**
   * Construct a new notebook panel.
   */
  constructor(model: INotebookModel, rendermime: RenderMime<Widget>, context: IDocumentContext, clipboard: IClipboard) {
    super();
    this.addClass(NB_PANEL);
    this._model = model;
    this._rendermime = rendermime;
    this._context = context;
    this._clipboard = clipboard;

    context.kernelChanged.connect(() => {
      this.handleKernelChange(context.kernel);
    });
    if (context.kernel) {
      this.handleKernelChange(context.kernel);
    }

    this.layout = new PanelLayout();
    let ctor = this.constructor as typeof NotebookPanel;
    this._content = ctor.createContent(model, rendermime);
    this._toolbar = ctor.createToolbar();

    let container = new Panel();
    container.addClass(NB_CONTAINER);
    container.addChild(this._content);

    let layout = this.layout as PanelLayout;
    layout.addChild(this._toolbar);
    layout.addChild(container);

    // Instantiate tab completion widget.
    this._completion = ctor.createCompletion();
    this._completion.reference = this;
    this._completion.attach(document.body);
    this._completion.selected.connect(this.onCompletionSelect, this);

    // Connect signals.
    this._content.stateChanged.connect(this.onContentChanged, this);
    let cell = this._content.childAt(this._content.activeCellIndex);
    if (cell) {
      let editor = cell.editor;
      editor.textChanged.connect(this.onTextChange, this);
      editor.completionRequested.connect(this.onCompletionRequest, this);
    }

    // Handle the document title.
    this.title.text = context.path.split('/').pop();
    context.pathChanged.connect((c, path) => {
      this.title.text = path.split('/').pop();
    });

    // Handle changes to dirty state.
    model.stateChanged.connect((m, args) => {
      if (args.name === 'dirty') {
        if (args.newValue) {
          this.title.className += ` ${DIRTY_CLASS}`;
        } else {
          this.title.className = this.title.className.replace(DIRTY_CLASS, '');
        }
      }
    });
  }

  /**
   * Get the toolbar used by the widget.
   */
  get toolbar(): NotebookToolbar {
    return this._toolbar;
  }

  /**
   * Get the content area used by the widget.
   *
   * #### Notes
   * This is a read-only property.
   */
  get content(): ActiveNotebook {
    return this._content;
  }

  /**
   * Get the rendermime instance used by the widget.
   *
   * #### Notes
   * This is a read-only property.
   */
  get rendermime(): RenderMime<Widget> {
    return this._rendermime;
  }

  /**
   * Get the clipboard instance used by the widget.
   *
   * #### Notes
   * This is a read-only property.
   */
  get clipboard(): IClipboard {
    return this._clipboard;
  }

  /**
   * Get the model used by the widget.
   *
   * #### Notes
   * This is a read-only property.
   */
  get model(): INotebookModel {
    return this._model;
  }

  /**
   * Get the document context for the widget.
   *
   * #### Notes
   * This is a read-only property.
   */
  get context(): IDocumentContext {
    return this._context;
  }

  /**
   * Dispose of the resources used by the widget.
   */
  dispose(): void {
    if (this.isDisposed) {
      return;
    }
    this._context = null;
    this._rendermime = null;
    this._content = null;
    this._toolbar = null;
    this._clipboard = null;
    this._completion.dispose();
    this._completion = null;
    super.dispose();
  }

  /**
   * Restart the kernel on the panel.
   */
  restart(): Promise<boolean> {
    let kernel = this.context.kernel;
    if (!kernel) {
      return Promise.resolve(false);
    }
    return showDialog({
      title: 'Restart Kernel?',
      body: 'Do you want to restart the current kernel? All variables will be lost.',
      host: this.node
    }).then(result => {
      if (result.text === 'OK') {
        return kernel.restart().then(() => { return true; });
      } else {
        return false;
      }
    });
  }

  /**
   * Handle a change in the kernel by updating the document metadata.
   */
  protected handleKernelChange(kernel: IKernel): void {
    kernel.kernelInfo().then(info => {
      let infoCursor = this.model.getMetadata('language_info');
      infoCursor.setValue(info.language_info);
    });
    kernel.getKernelSpec().then(spec => {
      let specCursor = this.model.getMetadata('kernelspec');
      specCursor.setValue({
        name: kernel.name,
        display_name: spec.display_name,
        language: spec.language
      });
    });
  }

  /**
   * Handle a change in the content area.
   */
  protected onContentChanged(sender: ActiveNotebook, args: IChangedArgs<any>): void {
    switch (args.name) {
    case 'activeCellIndex':
      let cell = this._content.childAt(args.oldValue);
      let editor = cell.editor;
      editor.textChanged.disconnect(this.onTextChange, this);
      editor.completionRequested.disconnect(this.onCompletionRequest, this);

      cell = this._content.childAt(args.newValue);
      editor = cell.editor;
      editor.textChanged.connect(this.onTextChange, this);
      editor.completionRequested.connect(this.onCompletionRequest, this);
      break;
    default:
      break;
    }
  }

  /**
   * Handle a text changed signal from an editor.
   */
  protected onTextChange(editor: CellEditorWidget, change: ITextChange): void {
    let line = change.newValue.split('\n')[change.line];
    let model = this._completion.model;
    // If last character entered is not whitespace, update completion.
    if (line[change.ch - 1] && line[change.ch - 1].match(/\S/)) {
      // If there is currently a completion
      if (model.original) {
        model.current = change;
      }
    } else {
      // If final character is whitespace, reset completion.
      model.options = null;
      model.original = null;
      model.cursor = null;
      return;
    }
  }

  /**
   * Handle a completion requested signal from an editor.
   */
  protected onCompletionRequest(editor: CellEditorWidget, change: ICompletionRequest): void {
    let kernel = this.context.kernel;
    if (!kernel) {
      return;
    }
    let contents = {
      // Only send the current line of code for completion.
      code: change.currentValue.split('\n')[change.line],
      cursor_pos: change.ch
    };
    let pendingComplete = ++this._pendingComplete;
    let model = this._completion.model;
    kernel.complete(contents).then(value => {
      // If model has been disposed, bail.
      if (model.isDisposed) {
        return;
      }
      // If a newer completion requesy has created a pending request, bail.
      if (pendingComplete !== this._pendingComplete) {
        return;
      }
      // Completion request failures or negative results fail silently.
      if (value.status !== 'ok') {
        return;
      }
      // Update the model.
      model.options = value.matches;
      model.cursor = { start: value.cursor_start, end: value.cursor_end };
    }).then(() => {
      model.original = change;
    });
  }

  /**
   * Handle a completion selected signal from the completion widget.
   */
  protected onCompletionSelect(widget: CompletionWidget, value: string): void {
    let patch = this._completion.model.createPatch(value);
    let cell = this._content.childAt(this._content.activeCellIndex);
    let editor = cell.editor.editor;
    let doc = editor.getDoc();
    doc.setValue(patch.text);
    doc.setCursor(doc.posFromIndex(patch.position));
  }

  private _rendermime: RenderMime<Widget> = null;
  private _context: IDocumentContext = null;
  private _model: INotebookModel = null;
  private _content: ActiveNotebook = null;
  private _toolbar: NotebookToolbar = null;
  private _clipboard: IClipboard = null;
  private _completion: CompletionWidget = null;
  private _pendingComplete = 0;
}
