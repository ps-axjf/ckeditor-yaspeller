(function(){
    CKEDITOR.plugins.add('yaspeller',
    {
        init: function(editor){
            separator = ".,\"'?!;: "
            cinstance = ''
            focusafter = true

            editor.on( 'contentDom', function(){
			    var doc = editor.document;
				body = doc.getBody();
				html = doc.getDocumentElement();
				doc.on('keydown', checkSpell, editor);
                doc.appendStyleSheet(CKEDITOR.plugins.getPath('yaspeller')+'css/yaspeller.css')
				if (typeof yaspeller_errors  == "undefined") yaspeller_errors={}
				if (typeof yaspeller_corrs  == "undefined") yaspeller_corrs={}
				if (typeof yaspeller_sarr  == "undefined") yaspeller_sarr={}
				yaspeller_errors[editor.name] = {}
				yaspeller_corrs[editor.name] = {}
				yaspeller_sarr[editor.name] = new Array()
				checkSpellInit(body, editor.name)
			});

            var dataProcessor = editor.dataProcessor;
			htmlFilter = dataProcessor && dataProcessor.htmlFilter;
			if (htmlFilter){
			    htmlFilter.addRules({
				    elements :
					{
						span : function(element){
							if (element.attributes['data-spell-word']){
								delete element.name;
								return element;
							}
						}
					}
				});
		    }

		    var elementsPathFilters,spellFilter = function(element){if (element.hasAttribute('data-spell-word')){return false;}};
			if (editor._.elementsPath && (elementsPathFilters = editor._.elementsPath.filters)){elementsPathFilters.push(spellFilter);}
			editor.addRemoveFormatFilter && editor.addRemoveFormatFilter(spellFilter);

            if (editor.addMenuItem) {editor.addMenuGroup('yaspellergroup',-1);}
            if (editor.contextMenu){
                editor.contextMenu.addListener(function(element, selection){
                    if (element && element.is('span') && element.getAttribute('data-spell-word')){
                        var e_word = element.getText()
                        var ea = {}
                        if (yaspeller_errors[editor.name][e_word].s.length>0){
                            for (var i=0;i<yaspeller_errors[editor.name][e_word].s.length;i++){
                                editor.addMenuItem('yaspelleritem'+yaspeller_errors[editor.name][e_word].s[i], {
                                    label: yaspeller_errors[editor.name][e_word].s[i],
                                    onClick: function (){replaceWord(this.editor, this.label);},
                                    group: 'yaspellergroup',
                                    order: -1
                                  });
                                ea['yaspelleritem'+yaspeller_errors[editor.name][e_word].s[i]] = CKEDITOR.TRISTATE_OFF
                            }
                        }
                        else {
                            editor.addMenuItem('yaspellerno', {
                                label: 'No variants for "'+e_word+'"',
                                group: 'yaspellergroup',
                                order: -1
                            });
                            ea['yaspellerno'] = CKEDITOR.TRISTATE_DISABLED
                        }
                        return ea
                    }
                    else { return null;}
                });
            }
        }




    });

    CKEDITOR.plugins.yaspeller =
	{
	    check: function(text){
	        temp_err = new Array()
	        for (i=0;i<text.length;i++){temp_err.push(text[i].word)}
		    for (i=0;i<yaspeller_sarr[cinstance].length;i++){if (!inArray(temp_err, yaspeller_sarr[cinstance][i])){ yaspeller_corrs[cinstance][yaspeller_sarr[cinstance][i]] = 1;}}
            for (i=0;i<text.length;i++) {yaspeller_errors[cinstance][text[i].word] = text[i]}
            if (focusafter) {
                var range = CKEDITOR.instances[cinstance].getSelection().getRanges()[0];
                var s = range.createBookmark(true)
            }
            var errs = CKEDITOR.instances[cinstance].document.getElementsByTag('span')
            var errs_len = errs.count()
            if (errs_len>0){for (var i=errs_len-1;i>=0;i--){if (errs.getItem(i).hasClass('yaspeller_error')){errs.getItem(i).remove(true);}}}
            var current_text = CKEDITOR.instances[cinstance].getData()
            for (word in yaspeller_errors[cinstance]){current_text = current_text.replace(word, '<span class="yaspeller_error" data-spell-word="'+word+'">'+word+'</span>')}
            CKEDITOR.instances[cinstance].document.getBody().setHtml(current_text)
            if (focusafter){
                var newRange = new CKEDITOR.dom.range(range.document);
                newRange.moveToBookmark(s)
                newRange.select()
            }
            cinstance = ''
        }
	};


    var checkSpellTimer = null;

    function replaceWord(editor, word){
        if (CKEDITOR.env.ie){editor.focus();}
        var range = editor.getSelection().getRanges()[0]
        var parent = range.startContainer.getParent()
        if (CKEDITOR.env.ie){
            parent.getChildren().getItem(0).$.data=''
            range.startContainer.$.data=word
        }
        else { range.startContainer.$.replaceWholeText(word);}
        parent.remove(true)
        editor.focus();
        range.select();
    }

    function getCharset() {
        var CharSet = document.characterSet;
        if (CharSet === undefined) {CharSet = document.charset;}
        if (CharSet.toLowerCase()=='windows-1251') {return '1251';}
        else {return 'utf-8';}
    }

    function checkSpell(e){
        if (e.data.$.keyCode<37 || e.data.$.keyCode>40){
            cinstance = this.name
            var range = this.getSelection().getRanges()[0];
            var parent = range.startContainer.getParent()
            if (checkSpellTimer) {clearTimeout(checkSpellTimer);}
            checkSpellTimer = CKEDITOR.tools.setTimeout( checkSpellExec, 1000, this);
            if (parent.hasAttribute('data-spell-word')){
                parent.remove(true);
                range.select();
            }
        }
    }


    function getWord(text, offset){
        var word_start = 0
        var word_end = 500
        var first_part = text.substr(0, offset)
        var second_part = text.substr(offset)
        for (var i=0;i<separator.length;i++){
            cs = first_part.lastIndexOf(separator[i])
            if (cs>word_start){word_start = cs+1;}
            sc = second_part.indexOf(separator[i])
            if (sc!=-1 && sc<word_end){word_end = sc;}
        }
        if (word_start==-1){word_start = 0;}
        if (word_end==500){word_end = text.length;}
        else {word_end = offset-word_start + word_end;}
        return text.substr(word_start, word_end)

    }

    function checkWord(text, charset){
        cinstance = cinstance
        var text = text.substring(0, text.length-1);
        var request = "http://speller.yandex.net/services/spellservice.json/checkText?options=8&format=plain&ie="+charset+"&text="+text+"&callback=CKEDITOR.plugins.yaspeller.check";
        var head = document.getElementsByTagName("head").item(0);
        var script = document.createElement("script");
        script.setAttribute("type", "text/javascript");
        script.setAttribute("src", request);
        head.appendChild(script);
    }


    function splitText(text){
        var words = new Array()
        var seps = new Array()
        var text = text.replace(/([.,\"'?!;: ]+$)/g, "")+' '
        for (var i=0;i<text.length;i++){ if (/[.,\"'?!;: ]/gm.test(text[i])){seps.push(i);}}
        if (seps.length==0){words.push(text);}
        else {
            for (var i=0;i<seps.length;i++){
                if (!seps[i-1]){words.push(text.slice(0,seps[i]).replace(/(^\s+)|(\s+$)/g,""));}
                else {
                    if (!seps[i+1]){
                        words.push(text.slice(seps[i-1]+1, seps[i]).replace(/(^\s+)|(\s+$)/g,""));
                        words.push(text.slice(seps[i]+1).replace(/(^\s+)|(\s+$)/g,""));
                    }
                    else {words.push(text.slice(seps[i-1]+1, seps[i]).replace(/(^\s+)|(\s+$)/g,""));}
                }
            }
        }
        return words
    }

    function uniqueArray(a){
       var r = new Array();
       o:for(var i = 0, n = a.length; i < n; i++){for(var x = 0, y = r.length; x < y; x++){if(r[x]==a[i]) continue o;}r[r.length] = a[i];}
       return r;
    }

    function inArray(array, value){
        for (var i=0; i<array.length;i++){if (array[i]==value) return true;}
        return false;
    }

    function checkSpellExec(){
        var range = this.getSelection().getRanges()[0];
        range.shrink(CKEDITOR.SHRINK_TEXT)
        var send_text = ''
        cinstane = this.name
        var text = this.document.getBody().getChild(0).getText()
        var splitted_text = uniqueArray(splitText(text))
        for (word in yaspeller_errors[cinstance]) {if (!inArray(splitted_text, word)){delete yaspeller_errors[cinstance][word];}}
        for (word in yaspeller_corrs[cinstance]) {if (!inArray(splitted_text, word)){delete yaspeller_corrs[cinstance][word];}}
        if (splitted_text.length>0) {
            for (i=0;i<splitted_text.length;i++){
                if (!yaspeller_errors[cinstance][splitted_text[i]] && !yaspeller_corrs[cinstance][splitted_text[i]]){
                    yaspeller_sarr[cinstance].push(splitted_text[i])
                    send_text+=splitted_text[i]+' '
                }
            }
            focusafter = true
            checkWord(send_text, getCharset())
        }
        checkSpellTimer = null;
    }

    function checkSpellInit(body, name){
        var send_text = ''
        if (body.getChild(0)!=null){
            var text = body.getChild(0).getText()
            var splitted_text = uniqueArray(splitText(text))
            if (cinstance=='') {
                cinstance = name
                for (word in yaspeller_errors[cinstance]) {if (!inArray(splitted_text, word)){delete yaspeller_errors[cinstance][word];}}
                for (word in yaspeller_corrs[cinstance]) {if (!inArray(splitted_text, word)){delete yaspeller_corrs[cinstance][word];}}
                if (splitted_text.length>0) {
                    for (i=0;i<splitted_text.length;i++){
                        if (!yaspeller_errors[cinstance][splitted_text[i]] && !yaspeller_corrs[cinstance][splitted_text[i]]){
                            yaspeller_sarr[cinstance].push(splitted_text[i])
                            send_text+=splitted_text[i]+' '
                        }
                    }
                    focusafter = false
                    checkWord(send_text, getCharset())
                }
            }
            else CKEDITOR.tools.setTimeout( checkSpellInit, 100, this, [body, name]);
        }
    }


})();

