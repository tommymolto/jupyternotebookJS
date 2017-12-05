/*-----------------------------------------------------------------------------
| Copyright (c) 2014-2016, Jupyter Development Team.
|
| Distributed under the terms of the Modified BSD License.
|----------------------------------------------------------------------------*/
'use strict';

import {
  showDialog
} from 'jupyter-js-ui/lib/dialog';

import {
  INotebookModel
} from './model';


// The message to display to the user when prompting to trust the notebook.
const TRUST_MESSAGE = '<p>A trusted Jupyter notebook may execute hidden malicious code when you open it.<br>Selecting trust will re-render this notebook in a trusted state.<br>For more information, see the <a href="http://ipython.org/ipython-doc/2/notebook/security.html">Jupyter security documentation</a>.</p>';


/**
 * Trust the notebook after prompting the user.
 *
 * @param model - The notebook model.
 *
 * @param host - The host node for the confirmation dialog (defaults to body).
 *
 * @returns a promise that resolves when the transaction is finished.
 *
 * #### Notes
 * No dialog will be presented if the notebook is already trusted.
 */
export
function trustNotebook(model: INotebookModel, host?: HTMLElement): Promise<void> {
  // Do nothing if already trusted.
  let cells = model.cells;
  let trusted = true;
  for (let i = 0; i < cells.length; i++) {
    let cell = cells.get(i);
    if (!cell.getMetadata('trusted').getValue()) {
      trusted = false;
    }
  }
  if (trusted) {
    return Promise.resolve(void 0);
  }
  return showDialog({
    host: host || document.body,
    body: TRUST_MESSAGE,
    title: 'Trust this notebook?'
  }).then(result => {
    if (result.text === 'OK') {
      for (let i = 0; i < cells.length; i++) {
        let cell = cells.get(i);
        cell.getMetadata('trusted').setValue(true);
      }
    }
  });
}
