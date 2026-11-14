
const forosController = {

    mostrarInicio: (req, res) => {
        res.render('foros/index', {
            titulo: 'Foros de discusión',
            descripcion: 'Participa en conversaciones y comparte ideas con otros usuarios.'
        });
    }

};

module.exports = forosController;
