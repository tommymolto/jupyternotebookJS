// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.
'use strict';

import {
  IKernelId
} from 'jupyter-js-services';

import {
  IWidgetFactory, IDocumentContext, findKernel
} from 'jupyter-js-ui/lib/docmanager';

import {
  RenderMime
} from 'jupyter-js-ui/lib/rendermime';

import {
  MimeData as IClipboard
} from 'phosphor-dragdrop';

import {
  Widget
} from 'phosphor-widget';

import {
  ToolbarItems
} from './default-toolbar';

import {
  INotebookModel
} from './model';

import {
  NotebookPanel
} from './panel';


/**
 * A widget factory for notebook panels.
 */
export
class NotebookWidgetFactory implements IWidgetFactory<NotebookPanel> {
  /**
   * Construct a new notebook widget factory.
   */
  constructor(rendermime: RenderMime<Widget>, clipboard: IClipboard) {
    this._rendermime = rendermime.clone();
    this._clipboard = clipboard;
  }

  /**
   * Get whether the factory has been disposed.
   */
  get isDisposed(): boolean {
    return this._rendermime === null;
  }

  /**
   * Dispose of the resources used by the factory.
   */
  dispose(): void {
    this._rendermime = null;
    this._clipboard = null;
  }

  /**
   * Create a new widget.
   */
  createNew(model: INotebookModel, context: IDocumentContext, kernel?: IKernelId): NotebookPanel {
    let rendermime = this._rendermime.clone();
    if (kernel) {
      context.changeKernel(kernel);
    } else {
      let name = findKernel(model.defaultKernelName, model.defaultKernelLanguage, context.kernelspecs);
      context.changeKernel({ name });
    }
    let panel = new NotebookPanel(model, rendermime, context, this._clipboard);
    ToolbarItems.populateDefaults(panel);
    return panel;
  }

  /**
   * Take an action on a widget before closing it.
   *
   * @returns A promise that resolves to true if the document should close
   *   and false otherwise.
   */
  beforeClose(model: INotebookModel, context: IDocumentContext, widget: NotebookPanel): Promise<boolean> {
    // No special action required.
    return Promise.resolve(true);
  }

  private _rendermime: RenderMime<Widget> = null;
  private _clipboard: IClipboard = null;
}
