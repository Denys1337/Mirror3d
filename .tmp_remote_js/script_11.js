/**
 * @var {jsItem|null} initialConfig const declared in template
 */

$(document).ready(function () {
    let dbConfig = [];
    const $form = $('#buy_form');
    const sdclProductId = $form.find('[name=a]').val();

    function updateDbConfigs() {
        getDatabaseConfigurations().then(res => {
            dbConfig = res;
            let dbConfigIds = dbConfig.map(dbConfigItem => dbConfigItem.id)
            let lsConfig = getLocalConfiguration();
            let result = [...lsConfig];
            let storedIds = lsConfig.map(dbConfigItem => dbConfigItem.id)

            dbConfig.forEach(dbConfigItem => {
                if (dbConfigItem.id) {
                    if (!storedIds.includes(dbConfigItem.id)) {
                        result.push(dbConfigItem);
                    }
                }
            });
            result.forEach(el => {
                if(el.id && !dbConfigIds.includes(el.id)) {
                    el.id = null;
                }
            });

            result.sort((a, b) => -1 * (a.created_at > b.created_at ? 1 : (a.created_at === b.created_at) ? 0 : -1));
            setLocalConfiguration(result);

            renderSelectDialog() ;
        }).catch(e => {
            console.error(e)
        })
    }

    //DB configurations
    updateDbConfigs();
    let $configuratorButtons = renderConfiguratorButtons();

    $('.sdcl-placeholder').append($configuratorButtons);
    renderSelectDialog();


    function startSpinner(target) {
        if(!target || !target.length) {
            target = '.product-offer';
        }
        target = $(target);
        if ($('.jtl-spinner-inner').length === 0) {
            target.append('<div class="jtl-spinner-inner"><i class="fa fa-spinner fa-pulse"></i></div>');
        }
    }

    function stopSpinner(target) {
        if(window.stopSpinnerTimer) {
            clearTimeout(window.stopSpinnerTimer)
        }
        window.stopSpinnerTimer = setTimeout(() => {
            if(!target) {
                $('.jtl-spinner-inner').remove();
            } else {
                $(target).children('.jtl-spinner-inner').remove();
            }
        }, 500);

    }

    function renderConfiguratorButtons() {
        const isEmptyBasket = $('.basket-empty').length;
        let $uiButtons = $(`
<div class="configuration-loader">
	<div class="configuration-loader-actions">
${isEmptyBasket ? '' : '<button type="button" class="btn btn-primary js-save-configuration">Diese Konfiguration für später speichern</button>'}
		<button type="button" class="btn btn-primary js-load-configuration">Ihre gespeicherte Konfiguration laden</button>
	</div>
</div>`);
        return $uiButtons;
    }

    function getSelectDialog() {
        return $('#configuration-loader-dialog');
    }

    function renderConfigurationItems(savedConfigurations) {
        return savedConfigurations.map((savedConfiguration, index) => {
            return renderConfigurationItem(savedConfiguration, index)
        }).join('\n');
    }

    /**
     * @param {jsProduct} cart
     * @param {number} cartIndex
     * */
    function renderConfigurationItem(cart, cartIndex) {
        const itemHtml = `<div class="sdcl-item-row" data-index="${cartIndex}">
	<div>
	<div class="sdcl-name">${escapeHtml(cart.name)}</div>
		<div class="actions">
		<button type="button" class="btn btn-primary js-load-sdcl-item" data-index="${cartIndex}"><i class="fa fa-upload mr-2"></i><span>Laden</span>
		<button type="button" class="btn btn-danger js-remove-sdcl-item" data-index="${cartIndex}"><i class="fa fa-trash mr-2"></i><span>Löschen</span>
		${cart.id ? `<button type="button" class="btn btn-secondary js-copy-sdcl-id" data-id="${cart.id}"><i class="fa fa-clipboard mr-2"></i
		    ><span>Code kopieren</span>
		</button>` : ''}
        ${cart.id ? `<button type="button" class="btn btn-secondary js-copy-sdcl-url" data-id="${cart.id}"><i class="fa fa-clipboard mr-2"></i
		    ><span>URL kopieren</span>
		</button>` : ''}
        
	</div>
</div>
    <div>
        <ul class="sdcl-cart-products">
            ${cart.description.split('\n').map(text => `<li class="sdcl-conf-item">${escapeHtml(text)}</li>`).join('\n')}
        </ul>
    </div>
	
</div>`;
        return itemHtml;
    }

    function renderSelectDialog(force = true) {
        let $selectDialog = getSelectDialog();
        if ($selectDialog.length && !force) {
            return $selectDialog;
        }
        let savedConfigurations = getSavedConfigurations();

        let body = savedConfigurations.length
            ? renderConfigurationItems(savedConfigurations)
            : '<p>Keine gespeicherten Konfigurationen</p>';

        if (!$selectDialog.length) {
            $selectDialog = $(`<div class="modal fade" id="configuration-loader-dialog">
	<div class="modal-dialog">
		<div class="modal-content">
			<div class="modal-header cl-modal-header">
				<span class="cl-modal-title">Ihre gespeicherte Spiegelkonfiguration laden oder Ihren Code eingeben</span>
				<button type="button" class="close cl-modal-close" data-dismiss="modal" aria-label="Close">
					<span aria-hidden="true">&times;</span>
				</button>
			</div>

			<div class="modal-body">
			
			    <div class="pr-3">
			    <div class="input-group mb-3">
			                         <input id="load-code-input" type="text" class="form-control" placeholder="Code eingeben" aria-label="Code eingeben" >
			                          <div class="input-group-append">
			                            <span class="input-group-btn  btn btn-primary" id="load-code">Laden</span>
			                          </div> 
			                    </div></div>
                <div id="saved-list">
				    ${body}                
                </div>
			</div>

		
		</div>

	</div>
</div>

            `);
            $selectDialog.find('.cl-modal-close').on('click', function (e) {
                closeSelectDialog();
            });

            $('body').append($selectDialog)
        } else {
            $selectDialog.find('#saved-list').html(body);
        }



        return $selectDialog;
    }

    function getSavedConfigurations() {
        //local storage configurations
        let lsConfig = getLocalConfiguration();
        let result = [...lsConfig];

        return result;
    }

    function getSelectedConfiguration() {
        const index = $('#configuration-loader-select').val();
        if (index === null || index === '') {
            return null;
        }
        let configurations = getSavedConfigurations();
        return configurations[index] ?? null;
    }

    function getLocalConfiguration() {
        let lsConfig = [];
        let lsConfigItems = localStorage.getItem(`configuration_loader_artikel_${sdclProductId}`);

        try {
            if (lsConfigItems) {
                lsConfig = JSON.parse(lsConfigItems);
            }
        } catch (e) {
            console.error(e);
        }
        return lsConfig;
    }

    function setLocalConfiguration(config) {
        try {
            localStorage.setItem(`configuration_loader_artikel_${sdclProductId}`, JSON.stringify(config))
            return true;
        } catch (e) {
            console.error(e);
        }
        return false;
    }

    function getDatabaseConfigurations() {
        return new Promise((resolve, reject) => {
            $.evo.io().call('sdclGetProductConfigurations', [sdclProductId], this, function (error, res) {
                if (error) {
                    console.log('error', error, res);
                    reject(error); // Reject the promise on error
                    return;
                }

                if (res?.response) {
                    console.log(res);
                    resolve(res.response); // Resolve the promise with the successful response data
                    return;
                }

                // Handle cases where there's no error but also no 'res.response'
                reject('No response data received from sdclLoadCartConfiguration');
            });
        });
    }

    function closeSelectDialog() {
        return toggleSelectDialog(false);
    }

    function openSelectDialog() {
        return toggleSelectDialog(true);
    }

    function toggleSelectDialog(state = null) {
        const $dialog = getSelectDialog();
        if (state === null) {
            $dialog.modal('toggle');
            return;
        }
        if (state) {
            $dialog.modal('show');
        } else {
            $dialog.modal('hide');
        }
    }

    /**
     * @deprecated for configuration dropdown
     */
    function loadSelectedConfiguration() {
        const config = getSelectedConfiguration();
        if (config) {
            loadConfiguration(config)
        }
        closeSelectDialog();
    }


    function loadConfiguration(configuration) {
        if (!configuration?.items_json) {
            return;
        }
        startSpinner();

        let breite = null;
        let hoehe = null;
        let $standardSizeSelect = $('.standard-size select');
        let isStandard = false;
        let stadnardRef = $standardSizeSelect.attr('ref');
        for (let inputName in configuration.items_json) {
            const value = configuration.items_json[inputName];

            if (inputName === 'breite') {
                breite = value;
            }
            if (inputName === 'hoehe') {
                hoehe = value;
            }
            //standardSize
            if ($standardSizeSelect.length && stadnardRef && inputName === `item[${stadnardRef}][]`) {
                $standardSizeSelect.val(value).trigger('change');
            }
        }
        if ($standardSizeSelect.length && breite && hoehe) {
            $standardSizeSelect.find('option').each((i, el) => {
                const $el = $(el);
                if ($el.text().trim().startsWith(`${breite} x ${hoehe}`)) {
                    isStandard = true;
                    $standardSizeSelect.val($el.attr('value')).trigger('change');
                }
            });
        }
        if (!isStandard && breite && hoehe) {
            $('#custom-size-radio').attr('checked', 'checked').prop('checked', true);
            $form.find('.js-breite-facade').val(breite);
            $form.find('.js-hoehe-facade').val(hoehe);
        }



        for (let inputName in configuration.items_json) {
            if (inputName.includes('eigenschaftwert')) {
                continue;
            }
            const escapedInputName = escapeNameSelector(inputName);
            const value = configuration.items_json[inputName];
            $(`[name=${escapedInputName}]`).val(value).trigger('change');

            //schraege form-factor
            if (inputName === 'item[372][]') {
                switch (Number(value)) {
                    case 1864:
                        $('#selses1').trigger('click');
                        break;
                    case 1865:
                        $('#selses2').trigger('click');
                        break;
                    case 1866:
                        $('#selses5').trigger('click');
                        break;
                    case 1867:
                        $('#selses6').trigger('click');
                        break;
                    case 1877:
                        $('#selses3').trigger('click');
                        break;
                    case 1878:
                        $('#selses4').trigger('click');
                        break;
                    case 1879:
                        $('#selses7').trigger('click');
                        break;
                    case 1880:
                        $('#selses8').trigger('click');
                        break;

                }
            }
        }

        for (let inputName in configuration.items_json) {
            if (!inputName.includes('eigenschaftwert')) {
                continue;
            }
            const escapedInputName = escapeNameSelector(inputName);
            const value = configuration.items_json[inputName];
            $(`[name=${escapedInputName}]`).val(value).trigger('change');
        }

        if(typeof checkPosition === 'function' && typeof findInput === 'function') {
            let seite = findInput('seite');
            let seitePseudo = $('#position-input-group-side input');
            if (seite.length && seitePseudo.length) {
                seitePseudo.val(seite.val());
            }
            let unten = findInput('unten');
            let untenPseudo = $('#position-input-group-bottom input');
            if (unten.length && untenPseudo.length) {
                untenPseudo.val(unten.val());
            }

        }

        stopSpinner('.product-offer');

    }

    let configurationIsSaving = false;

    /**
     * @param {jsProduct} response
     */
    function renderSavedMessage(response) {
        if(response.id) {
            const successModal = $('#sdcl-saved-modal');
            successModal.find('.sdcl-config-url').text(`${document.location.origin}/?a=${sdclProductId}&sdcl_load=k${response.id}` );
            successModal.find('.sdcl-config-id').text(`K${response.id}`);
            successModal.modal('show');
        }
    }

    function saveConfiguration() {
        startSpinner($('.js-save-configuration').parent());

        if (configurationIsSaving) {
            return;
        }
        const configuration = getCurrentConfiguration();
        configurationIsSaving = true;
        $.evo.io().call('sdclSaveProductConfiguration', [configuration], this, function (error, res) {
            configurationIsSaving = false;
            stopSpinner(($('.js-save-configuration').parent()));

            if (error) {
                console.log('error', configuration, error, res);
                return;
            }

            if (res?.response) {
                console.log(res);
                addLocalConfigurationItem(res?.response);
                renderSelectDialog();
                renderSavedMessage(res?.response);
            }

        });
    }

    function addLocalConfigurationItem(res) {

        let lsItems = getLocalConfiguration();
        lsItems.filter(lsItem => {
            return lsItem.id !== res.id;
        });
        lsItems.unshift(res);
        setLocalConfiguration(lsItems);
    }

    function getCurrentConfiguration() {
        const data = {
            cHinweis: $form.find('[name=konfig_comment]').val(),
            product_id: $form.find('[name=a]').val(),
            items_json: {},
            name: $form.find('.product-title').text()
        };
        const description = [];
        const formData = $form.serializeArray();
        const plainInputs = ['breite', 'breite2', 'hoehe', 'hoehe2'];
        let sizeClause = [];
        formData.forEach((inputData) => {
            const $input = $form.find(`[name=${escapeNameSelector(inputData.name)}]`);

            if (plainInputs.includes(inputData.name)) {
                data.items_json[inputData.name] = inputData.value;
                if (inputData.name === 'konfig_comment') {
                    description.push(inputData.value);
                }
                switch (inputData.name) {
                    case 'breite':
                        sizeClause.push(`${inputData.value.replace('.', ',')} mm Breite oben`);
                        break;
                    case 'hoehe':
                        sizeClause.push(`${inputData.value.replace('.', ',')} mm Höhe links`);
                        break;
                    case 'breite2':
                        sizeClause.push(`${inputData.value.replace('.', ',')} mm Breite unten`);
                        break;
                    case 'hoehe2':
                        sizeClause.push(`${inputData.value.replace('.', ',')} mm Höhe rechts`);
                        break;
                }
                return;
            }
            if (/item\[\d+]\[]/.test(inputData.name)) {
                data.items_json[inputData.name] = inputData.value;
                let label = $input.data('placeholder');
                let text = $input.find('option:selected').text();
                if (label?.length && text?.length) {
                    description.push(`${label}: ${text}`);
                }
                return;
            }
            if (/eigenschaftwert\[\d+]/.test(inputData.name)) {
                data.items_json[inputData.name] = inputData.value;
                let label = $input.siblings('label').text();
                let text = inputData.value;
                if (label?.length && text?.length) {
                    description.push(`${label}: ${text}`);
                }
                return;
            }
        });
        //todo add sizes to description
        if (sizeClause.length) {
            description.unshift(`Ma�?e: ${sizeClause.join(', ')}`)
        }

        data.description = description.join('\n');

        return data;

    }

    /**
     *
     * @param index
     * @returns {jsCartConfig}
     */
    function removeLocalConfigurationAt(index) {
        let lsItems = getSavedConfigurations();
        let deletedItem = lsItems.splice(index, 1);
        setLocalConfiguration(lsItems);
        return deletedItem[0];
    }

    function escapeNameSelector(selector) {
        return selector.replace(/\[/g, "\\[").replace(/\]/g, "\\]");
    }

    function escapeHtml(text) {
        const map = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;",
        };

        return text.replace(/[&<>"']/g, function (m) {
            return map[m];
        });
    }


    $(document).on('click', '.js-load-configuration', () => {
        renderSelectDialog()
        openSelectDialog();
    });
    $(document).on('click', '.js-save-configuration', saveConfiguration);

    $(document).on('click', '.js-select-configuration', loadSelectedConfiguration);

    $(document).on('click', '.js-copy-sdcl-url', function (e) {
        const $this = $(this);
        const id = $this.data('id');
        let url = `${document.location.origin}/?a=${sdclProductId}&sdcl_load=k${id}`
        navigator.clipboard.writeText(url).then(() => {
            $this.addClass('text-success');
            setTimeout(() => $this.removeClass('text-success'), 1000);
        });
    });

    $(document).on('click', '.js-copy-sdcl-id', function (e) {
        const $this = $(this);
        const id = $this.data('id');
        navigator.clipboard.writeText(id).then(() => {
            $this.addClass('text-success');
            setTimeout(() => $this.removeClass('text-success'), 1000);
        });
    });

    $(document).on('click', '.js-remove-sdcl-item', function () {
        const $this = $(this);
        const index = $this.data('index');
        const deletedConfig = removeLocalConfigurationAt(index);

        if (deletedConfig.id) {
            $.evo.io().call('sdclDeleteProductConfiguration', [deletedConfig.id], this, function (error, res) {
                if (error) {
                    console.log('error', error, res);
                }
                updateDbConfigs();
            });
        }
        $this.closest('.sdcl-item-row').remove();
        $('#configuration-loader-dialog').find('#saved-list').html(renderConfigurationItems(getSavedConfigurations()));

    });
    $(document).on('click', '.js-load-sdcl-item', function () {
        const $this = $(this);
        const index = $this.data('index');
        const configuration = getSavedConfigurations();
        if (configuration[index] ?? null) {
            document.location.href = `/?a=${sdclProductId}&sdcl_index=${index}`;
            // loadConfiguration(configuration[index]);
        }

    });
    $(document).on('click', '#load-code', function () {
        const code = $('#load-code-input').val();
        if(!code) {
            return;
        }
        document.location.href = `${document.location.origin}/?a=${sdclProductId}&sdcl_load=k${code}`;

    });
    $(document).on('click', '.sdcl-config-url', function(e) {
        const $this = $(this);
        let copyText = $this.text();
        navigator.clipboard.writeText(copyText).then(() => {
            $this.addClass('text-success');
            setTimeout(() => $this.removeClass('text-success'), 1000);
        });
    });
    $(document).on('click', '.sdcl-config-id', function(e) {
        const $this = $(this);
        let copyText = $this.text();
        navigator.clipboard.writeText(copyText).then(() => {
            $this.addClass('text-success');
            setTimeout(() => $this.removeClass('text-success'), 1000);
        });
    });

    if (sdclProductConfig?.items_json) {
        loadConfiguration(sdclProductConfig);
    } else {
        if (sdcl_index !== null) {
            let configuration = getSavedConfigurations();
            if (configuration && configuration[sdcl_index]) {
                loadConfiguration(configuration[sdcl_index]);
            }
        }
    }



    let loadRequests = 0;
    let initialConfigLoaded = false;
    $(document).on('evo:load.io.request', function(e, data) {
        if(initialConfigLoaded) {
            return;
        }
        if (data?.req?.name === 'load_konfig') {
            loadRequests++;
            startSpinner();
        }
    }); $(document).on('evo:loaded.io.request', function(e, data) {
        if (data?.req?.name === 'load_konfig') {
            loadRequests--;
            if(loadRequests <= 0) {
                stopSpinner();
                initialConfigLoaded = true;
            }
        }
    });

    $(document).on('change', '.standard-or-custom-size .standard-size [id^="config"], .custom-size input.confinput', function () {
        const group = $(this).parents('.cfg-group')
        const itemId = group?.data('id');
        if (!itemId) return;

        const customSizeConfigItem = group.find('input[name="customSizeConfigItem"]').val();
        if (customSizeConfigItem !== undefined && customSizeConfigItem !== '') {
            group.find(`input[name="item[${itemId}][]"]`).val(customSizeConfigItem);
        }
    });
});

